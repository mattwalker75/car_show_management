// db/database.js - Database initialization and async wrappers
// Supports both SQLite and MySQL based on config.json settings.
// Provides promise-based wrappers for async/await usage.

const path = require('path');
const fs = require('fs');

// Load database configuration from config.json
const configPath = path.join(__dirname, '..', 'config.json');
let dbConfig = {
  engine: 'sqlite',
  sqlite: { filename: 'carshow.db' },
  mysql: {
    host: 'localhost',
    port: 3306,
    database: 'carshow',
    user: 'carshow_app',
    password: 'PASSWORD',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
  }
};

try {
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, 'utf8');
    const fullConfig = JSON.parse(configData);
    if (fullConfig.database) {
      dbConfig = Object.assign({}, dbConfig, fullConfig.database);
    }
  }
} catch (err) {
  console.error('Error loading database config, using defaults:', err.message);
}

// Database abstraction object
const db = {};

// Track which engine is in use
db.engine = dbConfig.engine || 'sqlite';

// ============================================================================
// SQLite Implementation
// ============================================================================
if (db.engine === 'sqlite') {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '..', dbConfig.sqlite.filename || 'carshow.db');

  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log(`Connected to SQLite database: ${dbConfig.sqlite.filename}`);

      // Enable foreign key enforcement (SQLite has this OFF by default)
      sqliteDb.run('PRAGMA foreign_keys = ON');

      // Run table migrations/creation
      runSQLiteMigrations(sqliteDb);
    }
  });

  // Fetch a single row
  db.getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  // Fetch all rows
  db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  // Run an INSERT, UPDATE, or DELETE statement
  // Resolves with { lastID, changes } from the statement result
  db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  // Callback-style wrappers (used by route files)
  db.get = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.get(sql, params, cb);
  };
  db.all = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.all(sql, params, cb);
  };
  db.run = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.run(sql, params, cb);
  };

  // Expose raw database for special cases
  db.raw = sqliteDb;

}
// ============================================================================
// MySQL Implementation
// ============================================================================
else if (db.engine === 'mysql') {
  const mysql = require('mysql2/promise');

  // Create connection pool
  const pool = mysql.createPool({
    host: dbConfig.mysql.host,
    port: dbConfig.mysql.port,
    database: dbConfig.mysql.database,
    user: dbConfig.mysql.user,
    password: dbConfig.mysql.password,
    connectionLimit: dbConfig.mysql.connectionLimit || 10,
    waitForConnections: dbConfig.mysql.waitForConnections !== false,
    queueLimit: dbConfig.mysql.queueLimit || 0
  });

  console.log(`Connected to MySQL database: ${dbConfig.mysql.database}@${dbConfig.mysql.host}:${dbConfig.mysql.port}`);

  // Fetch a single row
  db.getAsync = async function (sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows[0] || undefined;
  };

  // Fetch all rows
  db.allAsync = async function (sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  // Run an INSERT, UPDATE, or DELETE statement
  // Resolves with { lastID, changes } to match SQLite interface
  db.runAsync = async function (sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return {
      lastID: result.insertId,
      changes: result.affectedRows
    };
  };

  // Callback-style wrappers (used by route files)
  db.get = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.getAsync(sql, params).then(row => cb(null, row)).catch(err => cb(err));
  };
  db.all = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.allAsync(sql, params).then(rows => cb(null, rows)).catch(err => cb(err));
  };
  db.run = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.runAsync(sql, params).then(result => cb(null, result)).catch(err => cb(err));
  };

  // Expose pool for special cases
  db.raw = pool;

}
// ============================================================================
// Unknown Engine
// ============================================================================
else {
  console.error(`Unknown database engine: ${db.engine}. Supported: 'sqlite', 'mysql'`);
  process.exit(1);
}

// ============================================================================
// SQLite Migrations (table creation and schema updates)
// ============================================================================
function runSQLiteMigrations(sqliteDb) {
  // Create specialty votes tables if they don't exist
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS specialty_votes (
    specialty_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vote_name TEXT NOT NULL UNIQUE,
    description TEXT,
    allow_all_users BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS specialty_vote_voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    specialty_vote_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    UNIQUE(specialty_vote_id, user_id)
  )`);
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS specialty_vote_results (
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
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS judge_scores (
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
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS published_results (
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
  sqliteDb.run(`ALTER TABLE specialty_votes ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(vehicle_id)`, () => {});
  sqliteDb.run(`ALTER TABLE specialty_votes ADD COLUMN class_id INTEGER REFERENCES classes(class_id)`, () => {});

  // Add registration_price column to vehicles if it doesn't exist
  sqliteDb.run(`ALTER TABLE vehicles ADD COLUMN registration_price REAL DEFAULT 25.00`, () => {});

  // Add discount_price column to vendor_products if it doesn't exist
  sqliteDb.run(`ALTER TABLE vendor_products ADD COLUMN discount_price TEXT`, () => {});

  // Add admin_deactivated column to vendor_products if it doesn't exist
  sqliteDb.run(`ALTER TABLE vendor_products ADD COLUMN admin_deactivated BOOLEAN DEFAULT 0`, () => {});

  // Add admin_disabled column to vendor_business if it doesn't exist
  sqliteDb.run(`ALTER TABLE vendor_business ADD COLUMN admin_disabled BOOLEAN DEFAULT 0`, () => {});

  // Add chat_enabled column to users if it doesn't exist
  sqliteDb.run(`ALTER TABLE users ADD COLUMN chat_enabled BOOLEAN DEFAULT 0`, () => {});

  // Add chat_blocked column to users if it doesn't exist (read-only mode for blocked users)
  sqliteDb.run(`ALTER TABLE users ADD COLUMN chat_blocked BOOLEAN DEFAULT 0`, () => {});

  // Create chat_messages table
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
  )`);
}

module.exports = db;
