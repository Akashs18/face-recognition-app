const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",   // IMPORTANT: IPv4 only
  database: "face_app",
  password: "123456",
  port: 5432,
  ssl: false
});

module.exports = pool;
