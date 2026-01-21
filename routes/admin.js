const express = require("express");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const db = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* =========================
   CREATE USER (ADMIN ONLY)
========================= */
router.post(
  "/admin/create-user",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "All fields required" });
      }

      const hash = await bcrypt.hash(password, 10);

      await db.query(
        `INSERT INTO users_auth (name, email, password, role)
         VALUES ($1, $2, $3, $4)`,
        [name, email, hash, role]
      );

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "User creation failed" });
    }
  }
);

/* =========================
   ADMIN DASHBOARD
========================= */
router.get(
  "/admin/analytics",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const today = await db.query(`
        SELECT u.name, a.attendance_time, a.status, a.address
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.attendance_date = CURRENT_DATE
        ORDER BY a.attendance_time ASC
      `);

      const monthly = await db.query(`
        SELECT u.name, COUNT(*) AS days_present
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE date_trunc('month', a.attendance_date)
              = date_trunc('month', CURRENT_DATE)
        GROUP BY u.name
      `);

      const late = await db.query(`
        SELECT u.name, COUNT(*) AS late_days
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.status = 'LATE'
        GROUP BY u.name
      `);

      res.render("admin-dashboard", {
        today: today.rows,
        monthly: monthly.rows,
        late: late.rows
      });

    } catch (err) {
      console.error("ADMIN DASHBOARD ERROR:", err);
      res.status(500).send("Server error");
    }
  }
);

/* ============================
   EXPORT TODAY ATTENDANCE
============================ */
router.get(
  "/admin/export/today",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          u.name,
          a.attendance_date,
          a.attendance_time,
          a.status,
          a.latitude,
          a.longitude,
          a.address
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.attendance_date = CURRENT_DATE
        ORDER BY a.attendance_time ASC
      `);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Today Attendance");

      sheet.columns = [
        { header: "Name", key: "name", width: 20 },
        { header: "Date", key: "attendance_date", width: 15 },
        { header: "Time", key: "attendance_time", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Latitude", key: "latitude", width: 15 },
        { header: "Longitude", key: "longitude", width: 15 },
        { header: "Address", key: "address", width: 40 }
      ];

      result.rows.forEach(row => {
        sheet.addRow(row);
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=today_attendance.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (err) {
      console.error("EXPORT ERROR:", err);
      res.status(500).json({ error: "Export failed" });
    }
  }
);

/* ============================
   EXPORT MONTHLY ATTENDANCE
============================ */
router.get(
  "/admin/export/monthly",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const { month, year } = req.query;

      if (!month || !year) {
        return res.status(400).json({ error: "Month and year required" });
      }

      const result = await db.query(
        `
        SELECT 
          u.name,
          a.attendance_date,
          a.attendance_time,
          a.status,
          a.address
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE EXTRACT(MONTH FROM a.attendance_date) = $1
          AND EXTRACT(YEAR FROM a.attendance_date) = $2
        ORDER BY u.name, a.attendance_date
        `,
        [month, year]
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Monthly Attendance");

      sheet.columns = [
        { header: "Name", key: "name", width: 22 },
        { header: "Date", key: "attendance_date", width: 15 },
        { header: "Time", key: "attendance_time", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Location", key: "address", width: 40 }
      ];

      result.rows.forEach(row => sheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=attendance_${month}_${year}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (err) {
      console.error("MONTHLY EXPORT ERROR:", err);
      res.status(500).json({ error: "Export failed" });
    }
  }
);

module.exports = router;
