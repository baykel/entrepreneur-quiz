const Database = require("better-sqlite3"); // טוען ספריית SQLite

const db = new Database("data.sqlite"); // יוצר/פותח קובץ DB בשם data.sqlite

db.exec(`
  CREATE TABLE IF NOT EXISTS responses ( -- יוצר טבלה אם לא קיימת
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- מזהה רץ
    created_at TEXT NOT NULL, -- תאריך יצירה
    full_name TEXT NOT NULL, -- שם מלא
    gender TEXT NOT NULL, -- מגדר
    email TEXT, -- אימייל (אופציונלי)
    score INTEGER NOT NULL, -- ציון פנימי (לא מציגים למשתמש)
    type TEXT NOT NULL, -- סוג יזם
    answers_json TEXT NOT NULL -- תשובות בפורמט JSON
  );
`); // מריץ SQL

module.exports = db; // מייצא את החיבור ל-DB
