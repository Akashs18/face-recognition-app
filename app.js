const express = require("express");
const path = require("path");
const faceRoutes = require("./routes/face");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("uploads"));

/* ===========================
   PAGE ROUTES (EJS)
=========================== */
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/register-page", (req, res) => {
  res.render("register");
});

app.get("/attendance-page", (req, res) => {
  res.render("attendance");
});

/* ===========================
   API ROUTES
=========================== */
app.use("/", faceRoutes);

/* ===========================
   Chrome DevTools noise
=========================== */
app.get(
  "/.well-known/appspecific/com.chrome.devtools.json",
  (req, res) => res.status(204).end()
);

app.listen(3000, () =>
  console.log("Node server running on http://localhost:3000")
);
