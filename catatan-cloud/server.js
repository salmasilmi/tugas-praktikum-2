const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const OWNER_NAME = process.env.OWNER_NAME || "Mahasiswa";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "database",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initDb(retries = 20) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS catatan (
          id INT AUTO_INCREMENT PRIMARY KEY,
          judul VARCHAR(150) NOT NULL,
          isi TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Database siap.");
      return;
    } catch (err) {
      console.log(`Menunggu database (${i}/${retries}): ${err.code || err.message}`);
      await sleep(3000);
    }
  }
  throw new Error("Database tidak dapat dihubungi.");
}

// Healthcheck sederhana
app.get("/up", (req, res) => res.status(200).send("OK"));

app.get("/api/info", (req, res) => res.json({ owner: OWNER_NAME }));

app.get("/api/catatan", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM catatan ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/catatan", async (req, res) => {
  const { judul, isi } = req.body || {};
  if (!judul || !isi) {
    return res.status(400).json({ error: "judul dan isi wajib diisi" });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO catatan (judul, isi) VALUES (?, ?)",
      [judul, isi]
    );
    res.status(201).json({ id: result.insertId, judul, isi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/catatan/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM catatan WHERE id = ?", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Server berjalan di port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
