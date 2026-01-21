const jwt = require("jsonwebtoken");

const JWT_SECRET = "supersecret"; // move to .env later

/* ===========================
   Verify JWT
=========================== */
function authenticate(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}

/* ===========================
   Admin-only guard
=========================== */
function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).send("Access denied");
  }
  next();
}

module.exports = {
  authenticate,
  requireAdmin,
};
