const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const faceRoutes = require("./routes/face");
const authRoutes = require("./routes/auth");
const { authenticate, requireAdmin } = require("./middleware/auth");

const app = express();
//const PORT=3000;


/* ===========================
   GLOBAL MIDDLEWARE
=========================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

/* ===========================
   VIEW ENGINE
=========================== */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ===========================
   STATIC FILES
=========================== */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===========================
   AUTH ROUTES (API)
=========================== */
app.use(authRoutes);

/* ===========================
   PUBLIC PAGES
=========================== */
app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => {
  res.render("login");
});

/* Public attendance (security, cleaner, visitors) */
app.get("/attendance-public", (req, res) => {
  res.render("attendance-public");
});

/* ===========================
   PROTECTED DASHBOARDS
=========================== */

/* Employee dashboard */
app.get(
  "/employee/dashboard",
  authenticate,
  (req, res) => {
    res.render("employee-dashboard");
  }
);

/* Admin dashboard */
app.get(
  "/admin/dashboard",
  authenticate,
  requireAdmin,
  (req, res) => {
    res.redirect("/admin/analytics");
  }
);


/* ===========================
   FACE / ATTENDANCE API
=========================== */
app.use(faceRoutes);

/* ===========================
   LOGOUT
=========================== */
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

/* ===========================
   DEVTOOLS NOISE FIX
=========================== */
app.get(
  "/.well-known/appspecific/com.chrome.devtools.json",
  (req, res) => res.status(204).end()
);

/* ===========================
   attendance
=========================== */
app.get(
  "/attendance-page",
  authenticate,             // ensure user is authenticated
  (req, res) => {
    res.render("attendance", { user: req.user }); // pass user object
  }
);

/* ===========================
   attendance-register
=========================== */
app.get(
  "/register-page",
  authenticate,
  requireAdmin,
  (req, res) => {
    res.render("register");
  }
);

const adminRoutes = require("./routes/admin");
app.use(adminRoutes);


app.get("/employee-dashboard", authenticate, (req, res) => {
  res.render("employee-dashboard"); // or send the HTML
});


/* ===========================
   SERVER
=========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  
// app.listen(PORT, () => {
//   console.log(`✅ Server running at http://localhost:${PORT}`);
// });