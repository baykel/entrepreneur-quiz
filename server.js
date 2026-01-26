const express = require("express"); // שרת HTTP
const path = require("path"); // טיפול בנתיבים
const db = require("./db"); // חיבור לבסיס נתונים

const app = express(); // יוצר אפליקציה

app.use(express.json()); // מאפשר לקבל JSON
app.use(express.static(path.join(__dirname, "public"))); // מגיש קבצים מתיקיית public

function typeFromScore(score) { // מחזיר טיפוס לפי ציון
  if (score >= 10 && score <= 16) return "המתבוננת"; // טווח 1
  if (score >= 17 && score <= 23) return "החולמת"; // טווח 2
  if (score >= 24 && score <= 30) return "המחברת"; // טווח 3
  if (score >= 31 && score <= 40) return "המיישם"; // טווח 4
  return "לא ידוע"; // ברירת מחדל
}

app.post("/api/submit", (req, res) => { // מקבל תשובות ושומר
  const { fullName, gender, email, answers } = req.body; // קורא שדות מהלקוח

  if (!fullName || !gender) { // ולידציה בסיסית
    return res.status(400).json({ error: "fullName and gender are required" }); // מחזיר שגיאה
  }

  if (!Array.isArray(answers) || answers.length !== 10) { // בדיקה שמגיע 10 תשובות
    return res.status(400).json({ error: "answers must be array of 10" }); // שגיאה
  }

  for (const a of answers) { // בדיקה שכל תשובה היא 1..4
    if (![1, 2, 3, 4].includes(a)) { // אם יש ערך לא תקין
      return res.status(400).json({ error: "each answer must be 1..4" }); // שגיאה
    }
  }

  const score = answers.reduce((sum, a) => sum + a, 0); // סכום תשובות
  const type = typeFromScore(score); // מחשב טיפוס

  db.prepare(`
    INSERT INTO responses (created_at, full_name, gender, email, score, type, answers_json) -- מכניס נתונים
    VALUES (?, ?, ?, ?, ?, ?, ?) -- פרמטרים
  `).run(
    new Date().toISOString(), // created_at
    fullName, // full_name
    gender, // gender
    email || null, // email
    score, // score
    type, // type
    JSON.stringify(answers) // answers_json
  ); // מבצע insert

  return res.json({ type }); // מחזיר רק type (בלי ציון)
});

app.get("/api/stats", (req, res) => { // מחזיר סטטיסטיקות
  const total = db.prepare(`SELECT COUNT(*) AS c FROM responses`).get().c; // סופר הכל

  const byType = db.prepare(`
    SELECT type, COUNT(*) AS c -- סוג וכמות
    FROM responses
    GROUP BY type
    ORDER BY c DESC
  `).all(); // מביא מערך

  res.json({ total, byType }); // מחזיר JSON
});

app.get("/api/export.csv", (req, res) => { // יצוא CSV לאקסל/Sheets
  const rows = db.prepare(`
    SELECT created_at, full_name, gender, COALESCE(email,'') AS email, type
    FROM responses
    ORDER BY id ASC
  `).all(); // מביא שורות

  const header = "created_at,full_name,gender,email,type\n"; // כותרות CSV

  const safe = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`; // בריחה של מרכאות

  const body = rows
    .map(r => [r.created_at, r.full_name, r.gender, r.email, r.type].map(safe).join(",")) // שורה שורה
    .join("\n"); // חיבור כל השורות

  const out = "\uFEFF" + header + body; // BOM כדי שאקסל יציג עברית תקין

  const stamp = new Date().toISOString().replaceAll(":", "-"); // חותמת זמן לשם קובץ

  res.setHeader("Content-Type", "text/csv; charset=utf-8"); // סוג קובץ
  res.setHeader("Content-Disposition", `attachment; filename=responses_${stamp}.csv`); // שם קובץ
  res.send(out); // שולח להורדה
});

const PORT = process.env.PORT || 3000; // פורט של Render או 3000 מקומי
app.listen(PORT, () => { // מפעיל שרת
  console.log("Server running on http://localhost:" + PORT); // לוג בדיקה
});
