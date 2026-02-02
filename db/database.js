// db/database.js - Database initialization and async wrappers
// Initializes the SQLite database connection, creates required tables,
// and provides promise-based wrappers for async/await usage.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'carshow.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');

    // Enable foreign key enforcement (SQLite has this OFF by default)
    db.run('PRAGMA foreign_keys = ON');

    // Create specialty votes tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS specialty_votes (
      specialty_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_name TEXT NOT NULL UNIQUE,
      description TEXT,
      allow_all_users BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS specialty_vote_voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialty_vote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (user_id) REFERENCES users (user_id),
      UNIQUE(specialty_vote_id, user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS specialty_vote_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialty_vote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      car_id INTEGER NOT NULL,
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (user_id) REFERENCES users (user_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id),
      UNIQUE(specialty_vote_id, user_id)
    )`);

    // Create judge scores table
    db.run(`CREATE TABLE IF NOT EXISTS judge_scores (
      score_id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id INTEGER NOT NULL,
      car_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (judge_id) REFERENCES users (user_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id),
      FOREIGN KEY (question_id) REFERENCES judge_questions (judge_question_id),
      UNIQUE(judge_id, car_id, question_id)
    )`);

    // Create published results table
    db.run(`CREATE TABLE IF NOT EXISTS published_results (
      result_id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_type TEXT NOT NULL,
      class_id INTEGER,
      specialty_vote_id INTEGER,
      car_id INTEGER NOT NULL,
      place INTEGER NOT NULL,
      total_score REAL,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes (class_id),
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id)
    )`);

    // Add vehicle_id and class_id columns to specialty_votes if they don't exist
    db.run(`ALTER TABLE specialty_votes ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(vehicle_id)`, (err) => {});
    db.run(`ALTER TABLE specialty_votes ADD COLUMN class_id INTEGER REFERENCES classes(class_id)`, (err) => {});

    // Add registration_price column to vehicles if it doesn't exist
    db.run(`ALTER TABLE vehicles ADD COLUMN registration_price REAL DEFAULT 25.00`, (err) => {});

    // Add discount_price column to vendor_products if it doesn't exist
    db.run(`ALTER TABLE vendor_products ADD COLUMN discount_price TEXT`, (err) => {});

    // Add admin_deactivated column to vendor_products if it doesn't exist
    db.run(`ALTER TABLE vendor_products ADD COLUMN admin_deactivated BOOLEAN DEFAULT 0`, (err) => {});

    // Add admin_disabled column to vendor_business if it doesn't exist
    db.run(`ALTER TABLE vendor_business ADD COLUMN admin_disabled BOOLEAN DEFAULT 0`, (err) => {});

    // Add chat_enabled column to users if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN chat_enabled BOOLEAN DEFAULT 0`, (err) => {});

    // Create chat_messages table
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    )`);
  }
});

// ============================================================================
// Promise wrappers for async/await usage
// ============================================================================
// These allow route handlers to use: const row = await db.getAsync(sql, params)
// instead of nested callbacks, making the code much more readable.

// Fetch a single row
db.getAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Fetch all rows
db.allAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Run an INSERT, UPDATE, or DELETE statement
// Resolves with { lastID, changes } from the statement result
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

module.exports = db;
