const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const { authenticate } = require("../middleware/auth");
const router = express.Router();

const PYTHON_SERVICE_URL = "http://127.0.0.1:8001/embed";
const FACE_THRESHOLD = 0.45;
const REGISTER_FACE_THRESHOLD = 0.6; // stricter than attendance

/* ===========================
   REVERSE GEO API LOGIC
=========================== */
async function reverseGeocode(lat, lng) {
  try {
    const res = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat,
          lon: lng,
          format: "json"
        },
        headers: {
          "User-Agent": "face-attendance-app"
        }
      }
    );

    return res.data.display_name || null;
  } catch (e) {
    console.error("Geocode error:", e.message);
    return null;
  }
}


/* ===========================
   ATTENDANCE TIME LOGIC
=========================== */
function getAttendanceStatus() {
  const now = new Date();

  const hours = now.getHours();
  const minutes = now.getMinutes();

  // ON_TIME if before or at 09:05
  if (hours < 9 || (hours === 9 && minutes <= 5)) {
    return "ON_TIME";
  }

  return "LATE";
}

/* ===========================
   Multer config
=========================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

/* ===========================
   Cosine Similarity
=========================== */
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ===========================
   Get Face Embedding
=========================== */
async function getEmbedding(imagePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(imagePath));

  const res = await axios.post(PYTHON_SERVICE_URL, form, {
    headers: form.getHeaders(),
    timeout: 10000,
  });

  if (res.data.error || !res.data.embedding)
    throw new Error(res.data.error || "No face detected");

  return res.data.embedding;
}

/* ===========================
   REGISTER FACE
=========================== */
router.post("/register", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const embedding = await getEmbedding(req.file.path);

    // 🔍 CHECK EXISTING FACES
    const users = await db.query(
      "SELECT id, name, embedding FROM users"
    );

    for (const user of users.rows) {
      const score = cosineSimilarity(user.embedding, embedding);
      if (score > REGISTER_FACE_THRESHOLD) {
        return res.status(409).json({
          error: "Face already registered",
          existingUser: user.name,
          score
        });
      }
    }

    // ✅ SAFE TO REGISTER
    await db.query(
      "INSERT INTO users (name, embedding) VALUES ($1, $2)",
      [name, embedding]
    );

    res.json({ success: true, message: "Face registered" });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

/* ===========================
   ATTENDANCE (ONE PER DAY)
=========================== */
router.post("/attendance", upload.single("image"), async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const embedding = await getEmbedding(req.file.path);

    const users = await db.query(
      "SELECT id, name, embedding FROM users"
    );

    let bestMatch = { user: null, score: 0 };

    for (const user of users.rows) {
      const score = cosineSimilarity(user.embedding, embedding);
      if (score > bestMatch.score) {
        bestMatch = { user, score };
      }
    }

    if (bestMatch.score < FACE_THRESHOLD) {
      return res.json({ recognized: false });
    }

    const status = getAttendanceStatus();
    const address = latitude && longitude
      ? await reverseGeocode(latitude, longitude)
      : null;

    await db.query(
      `INSERT INTO attendance
       (user_id, status, latitude, longitude, address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, attendance_date) DO NOTHING`,
      [
        bestMatch.user.id,
        status,
        latitude,
        longitude,
        address
      ]
    );

    res.json({
      recognized: true,
      name: bestMatch.user.name,
      status,
      address
    });

  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: err.message });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

/* ===========================
   FACE LOGIN (ADMIN / EMPLOYEE)
=========================== */
router.post("/face-login", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image required" });
    }

    const embedding = await getEmbedding(req.file.path);

    const users = await db.query(
      `SELECT id, name, role, embedding
       FROM users
       WHERE role IN ('ADMIN', 'EMPLOYEE')`
    );

    let best = { score: 0, user: null };

    for (const u of users.rows) {
      const score = cosineSimilarity(u.embedding, embedding);
      if (score > best.score) {
        best = { score, user: u };
      }
    }

    if (!best.user || best.score < FACE_THRESHOLD) {
      return res.status(401).json({ error: "Face not recognized" });
    }

    const token = jwt.sign(
      { userId: best.user.id, role: best.user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      })
      .json({
        success: true,
        role: best.user.role,
        name: best.user.name
      });

  } catch (e) {
    console.error("FACE LOGIN ERROR:", e.message);
    res.status(500).json({ error: "Face login failed" });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});




/* ===========================
   DB TEST
=========================== */
router.get("/db-test", async (_, res) => {
  try {
    const r = await db.query("SELECT 1 AS ok");
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


router.post("/attendance", authenticate, upload.single("image"), async (req, res) => {
  const embedding = await getEmbedding(req.file.path);
  const { latitude, longitude } = req.body;

  const user = await db.query(
    "SELECT id, embedding FROM users WHERE id=$1",
    [req.user.id]
  );

  const score = cosineSimilarity(
    user.rows[0].embedding,
    embedding
  );

  if (score < 0.45)
    return res.status(401).json({ error: "Face mismatch" });

  const exists = await db.query(
    `SELECT 1 FROM attendance 
     WHERE user_id=$1 AND attendance_date=CURRENT_DATE`,
    [req.user.id]
  );

  if (exists.rowCount)
    return res.json({ message: "Already marked today" });

  const address = await reverseGeocode(latitude, longitude);

  await db.query(
    `INSERT INTO attendance
     (user_id, status, latitude, longitude, address)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.user.id, getStatus(), latitude, longitude, address]
  );

  res.json({ success: true });
});




module.exports = router;
