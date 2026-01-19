const { Pool } = require("pg");

module.exports = new Pool({
  user: "demo_etml_user",
  host: "dpg-d5ks4eogjchc73bobkk0-a.oregon-postgres.render.com",
  database: "attendance",
  password: "Il0rZKXu7WDPWHm6DA4ViCfFtk9IxRA9",
  port: 5432
});
