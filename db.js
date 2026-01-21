const { Pool } = require("pg");

const pool = new Pool({
  user: "attendance_okzu_user",
  host: "dpg-d5o9qkd6ubrc73fcsrjg-a",   // IMPORTANT: IPv4 only
  database: "attendance_okzu",
  password: "KTh1EcsnNpzJrQKBvUVvs2VfnrLLOI7l",
  port: 5432,
  ssl: false
});

module.exports = pool;
