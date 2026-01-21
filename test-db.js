const db = require("./db");

(async () => {
  try {
    const res = await db.query("SELECT NOW()");
    console.log("✅ DB OK:", res.rows[0]);
  } catch (e) {
    console.error("❌ DB FAIL:", e);
  } finally {
    process.exit();
  }
})();
