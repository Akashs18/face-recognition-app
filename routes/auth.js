const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const JWT_SECRET = "supersecret"; // move to .env later

/* ======================
   POST /login
====================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const result = await db.query(
      `SELECT id, password, role, is_active
       FROM users_auth
       WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid email" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // ✅ SET COOKIE + RESPONSE (INSIDE ROUTE)
    return res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax"
      })
      .json({ role: user.role });

  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
