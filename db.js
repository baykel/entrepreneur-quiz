const Database = require("better-sqlite3"); // טוען ספריית SQLite

const db = new Database("data.sqlite"); 
// יוצר (או פותח) קובץ בסיס נתונים בשם data.sqlite

db.exec(`
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  score INTEGER NOT NULL,
  type TEXT NOT NULL,
  answers_json TEXT NOT NULL
);
`);
// יוצר טבלה בשם responses אם היא לא קיימת

module.exports = db; 
// מאפשר להשתמש בבסיס הנתונים בקבצים אחרים
