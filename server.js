const express = require("express");
require("dotenv").config();
const path = require("path");
const db = require("./db");
const { google } = require("googleapis");
const creds = require("./service-account.json");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

const SHEET_ID = "1koAxUohPcDfGgnaOWBtCJIX2Fh3b0o8KNzNYHPHRBe8";
const SHEET_TAB_NAME = "גיליון1"; // 👈 זה השם של הטאב למטה (תבדוק שהוא בדיוק ככה)

console.log("SA email:", creds.client_email);
console.log("Has private key:", !!creds.private_key);

const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key, // 👈 בלי replace
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

let sheets = null;

async function initGoogle() {
  await auth.authorize();
  console.log("Google auth OK");
  sheets = google.sheets({ version: "v4", auth });
}

initGoogle().catch((e) => {
  console.error("Google auth failed:", e.response?.data || e.message);
});

function ensureSheets(req, res, next) {
  if (!sheets) return res.status(503).json({ ok: false, error: "Sheets not ready yet" });
  next();
}

async function appendToSheetRow(values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB_NAME}!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

app.get("/api/token-test", async (req, res) => {
  try {
    const t = await auth.getAccessToken();
    res.json({ ok: true, hasToken: !!t?.token });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/sheets-read-test", ensureSheets, async (req, res) => {
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB_NAME}!A1:G2`,
    });
    res.json({ ok: true, values: r.data.values || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, details: err.response?.data || null });
  }
});

function typeFromScore(score) {
  if (score >= 10 && score <= 16) return "המתבוננים";
  if (score >= 17 && score <= 23) return "החולמים";
  if (score >= 24 && score <= 30) return "המחברים";
  if (score >= 31 && score <= 40) return "המיישמים";
  return "לא ידוע";
}

app.post("/api/submit", ensureSheets, async (req, res) => {
  try {
    const { fullName, gender, email, answers, newsletter } = req.body;

    if (!fullName || !gender) return res.status(400).json({ error: "fullName and gender are required" });
    if (!Array.isArray(answers) || answers.length !== 10) return res.status(400).json({ error: "answers must be array of 10" });
    for (const a of answers) if (![1, 2, 3, 4].includes(a)) return res.status(400).json({ error: "each answer must be 1..4" });

    const score = answers.reduce((s, a) => s + a, 0);
    const type = typeFromScore(score);
    const createdAt = new Date().toISOString();
    const nl = newsletter || "NO";

    db.prepare(`
      INSERT INTO responses (created_at, full_name, gender, email, score, type, answers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(createdAt, fullName, gender, email || null, score, type, JSON.stringify({ answers, newsletter: nl }));

    await appendToSheetRow([
      "",              // dream
      nl,              // newsletter
      type,            // type
      email || "",     // email
      gender,          // gender
      fullName,        // fullName
      createdAt        // timestamp
    ]);

    return res.json({ type });
  } catch (err) {
    console.error("submit failed:", err.response?.data || err);
    return res.status(500).json({ error: "submit failed", details: err.response?.data || null });
  }
});

app.post("/api/append", ensureSheets, async (req, res) => {
  try {
    const { fullName, gender, email, type, dream, newsletter } = req.body;
    if (!fullName || !gender || !type) return res.status(400).json({ error: "fullName, gender, type are required" });

    const createdAt = new Date().toISOString();

    await appendToSheetRow([
      dream || "",
      newsletter || "NO",
      type,
      email || "",
      gender,
      fullName,
      createdAt
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("append failed:", err.response?.data || err);
    return res.status(500).json({ error: "append failed", message: err.message, details: err.response?.data || null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));
