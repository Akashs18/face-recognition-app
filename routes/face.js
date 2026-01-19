const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const db = require("../db");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const PYTHON_SERVICE_URL = "http://localhost:8001/embed";
const FACE_THRESHOLD = 0.45;

/* ===========================
   Utility: Cosine Similarity
=========================== */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ===========================
   Utility: Get Face Embedding
=========================== */
async function getEmbedding(imagePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(imagePath));

  const response = await axios.post(
    PYTHON_SERVICE_URL,
    form,
    { headers: form.getHeaders(), timeout: 5000 }
  );

  if (!response.data.embedding)
    throw new Error("No face detected");

  return response.data.embedding;
}

/* ===========================
   ROUTE: Register Face
   POST /register
=========================== */
router.post("/register", upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ error: "Name required" });

    const embedding = await getEmbedding(req.file.path);

    await db.query(
      "INSERT INTO users (name, embedding) VALUES ($1, $2)",
      [name, embedding]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

/* ===========================
   ROUTE: Attendance
   POST /attendance
=========================== */
router.post("/attendance", upload.single("image"), async (req, res) => {
  try {
    const embedding = await getEmbedding(req.file.path);

    const result = await db.query(
      "SELECT id, embedding FROM users"
    );

    let bestMatch = { id: null, score: 0 };

    for (const user of result.rows) {
      const score = cosineSimilarity(user.embedding, embedding);
      if (score > bestMatch.score) {
        bestMatch = { id: user.id, score };
      }
    }

    if (bestMatch.score < FACE_THRESHOLD) {
      return res.json({ recognized: false });
    }

    // Prevent duplicate attendance (same day)
    await db.query(
      `INSERT INTO attendance (user_id, date)
       VALUES ($1, CURRENT_DATE)
       ON CONFLICT DO NOTHING`,
      [bestMatch.id]
    );

    res.json({
      recognized: true,
      userId: bestMatch.id,
      score: bestMatch.score
    });

  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

module.exports = router;
