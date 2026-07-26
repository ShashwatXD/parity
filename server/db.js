import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'parity.db');

const db = new sqlite3.Database(dbPath);

// Promisify database operations
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize schema
export const initDB = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      rounds INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      config TEXT,
      verdict TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      memory_snapshot TEXT,
      tokens_prompt INTEGER DEFAULT 0,
      tokens_completion INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES debates(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      config TEXT NOT NULL,
      runs INTEGER NOT NULL,
      results TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('SQLite database initialized successfully at', dbPath);
};
