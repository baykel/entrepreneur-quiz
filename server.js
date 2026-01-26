const express = require("express"); // שרת
const path = require("path"); // נתיבים
const db = require("./db"); // DB

const app = express();

app.use(express.json()); // מאפשר לקבל JSON
app.use(express.static(path.join(__dirname, "public"))); // מגיש את public

function typeFromScore(score) { // קובע טיפוס לפי ציון
  if (score >= 10 && score <= 16) return "המתבוננת";
  if (score >= 17 && score <= 23) return "החולמת";
  if (score >= 24 && score <= 30) return "המחברת";
  if (score >= 31 && score <= 40) return "המיישם";
  return "לא ידוע";
}

app.post("/api/submit", (req, res) => { // מקבל תשובות ושומר
  const { name, phone, answers } = req.body;

  if (!Array.isArray(answers) || answers.length !== 10) {
    return res.status(400).json({ error: "answers must be array of 10" });
  }

  for (const a of answers) { // בדיקה ערכים 1-4
    if (![1, 2, 3, 4].includes(a)) {
      return res.status(400).json({ error: "each answer must be 1..4" });
    }
  }

  const score = answers.reduce((sum, a) => sum + a, 0); // חישוב ציון
  const type = typeFromScore(score); // חישוב טיפוס

  db.prepare(`
    INSERT INTO responses (created_at, name, phone, score, type, answers_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    name || null,
    phone || null,
    score,
    type,
    JSON.stringify(answers)
  );

  res.json({ score, type });
});

app.get("/api/stats", (req, res) => { // מחזיר סטטיסטיקות
  const total = db.prepare(`SELECT COUNT(*) AS c FROM responses`).get().c;

  const byType = db.prepare(`
    SELECT type, COUNT(*) AS c
    FROM responses
    GROUP BY type
    ORDER BY c DESC
  `).all();

  res.json({ total, byType });
});

app.get("/api/export.txt", (req, res) => { // מחזיר קובץ טקסט
  const total = db.prepare(`SELECT COUNT(*) AS c FROM responses`).get().c;

const stamp = new Date().toISOString().replaceAll(":", "-"); // מייצר חותמת זמן בטוחה לשם קובץ
res.setHeader("Content-Disposition", `attachment; filename=export_${stamp}.txt`); // גורם להורדה עם שם דינמי


  const byType = db.prepare(`
    SELECT type, COUNT(*) AS c
    FROM responses
    GROUP BY type
    ORDER BY c DESC
  `).all();

  const rows = db.prepare(`
    SELECT created_at, COALESCE(name,'') AS name, COALESCE(phone,'') AS phone, score, type
    FROM responses
    ORDER BY id ASC
  `).all();

  let out = "";
  out += `סיכום שאלון - יצוא\n`;
  out += `סה"כ משיבים: ${total}\n\n`;
  out += `חלוקה לפי טיפוס:\n`;
  for (const r of byType) out += `- ${r.type}: ${r.c}\n`;

  out += `\nרשימת משיבים:\n`;
  out += `created_at | name | phone | score | type\n`;
  out += `------------------------------------------------------\n`;
  for (const r of rows) {
    out += `${r.created_at} | ${r.name} | ${r.phone} | ${r.score} | ${r.type}\n`;
  }
  res.setHeader("Content-Disposition", "attachment; filename=export.txt"); // מכריח הורדה כקובץ בשם export.txt
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(out);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { // הפעלת שרת
  console.log("Server running on http://localhost:" + PORT);
});
