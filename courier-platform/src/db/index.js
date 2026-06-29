const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../courier.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    // node:sqlite exec doesn't support multiple statements split by semicolon in one call on some versions
    schema.split(/;\s*\n/).forEach(stmt => {
      const s = stmt.trim();
      if (s && !s.startsWith('PRAGMA')) db.exec(s + ';');
    });
  }
  return db;
}

module.exports = { getDb };
