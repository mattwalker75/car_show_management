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

  // Track migration status - db.ready resolves when migrations complete
  let migrationsResolve;
  db.ready = new Promise((resolve) => { migrationsResolve = resolve; });

  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log(`Connected to SQLite database: ${dbConfig.sqlite.filename}`);

      // Enable foreign key enforcement (SQLite has this OFF by default)
      sqliteDb.run('PRAGMA foreign_keys = ON');

      // Enable WAL mode for better concurrent read/write performance
      // Allows readers to continue while a write is in progress
      sqliteDb.run('PRAGMA journal_mode = WAL');

      // Set busy timeout to wait for locks instead of failing immediately
      // Prevents "database is locked" errors during brief contention
      sqliteDb.run('PRAGMA busy_timeout = 5000');

      // Run table migrations/creation and signal when complete
      runSQLiteMigrations(sqliteDb)
        .then(() => { migrationsResolve(); })
        .catch((err) => {
          console.error('Migrations failed, continuing anyway:', err.message);
          migrationsResolve();
        });
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
  // Note: errors are logged automatically for debugging
  db.get = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.get(sql, params, (err, row) => {
      if (err) console.error('DB get error:', err.message, '| SQL:', sql.substring(0, 100));
      cb(err, row);
    });
  };
  db.all = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) console.error('DB all error:', err.message, '| SQL:', sql.substring(0, 100));
      cb(err, rows);
    });
  };
  db.run = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    sqliteDb.run(sql, params, function (err) {
      if (err) console.error('DB run error:', err.message, '| SQL:', sql.substring(0, 100));
      cb.call(this, err);
    });
  };

  // Expose raw database for special cases
  db.raw = sqliteDb;

  // Close database connection (for graceful shutdown)
  db.close = function () {
    return new Promise((resolve, reject) => {
      sqliteDb.close((err) => {
        if (err) {
          console.error('Error closing SQLite database:', err.message);
          reject(err);
        } else {
          console.log('SQLite database connection closed');
          resolve();
        }
      });
    });
  };

}
// ============================================================================
// MySQL Implementation
// ============================================================================
else if (db.engine === 'mysql') {
  const mysql = require('mysql2/promise');

  // Create connection pool with reasonable queue limit to prevent memory exhaustion
  const pool = mysql.createPool({
    host: dbConfig.mysql.host,
    port: dbConfig.mysql.port,
    database: dbConfig.mysql.database,
    user: dbConfig.mysql.user,
    password: dbConfig.mysql.password,
    connectionLimit: dbConfig.mysql.connectionLimit || 10,
    waitForConnections: dbConfig.mysql.waitForConnections !== false,
    queueLimit: dbConfig.mysql.queueLimit || 100 // Default to 100 if not set (was 0 = unlimited)
  });

  console.log(`Connected to MySQL database: ${dbConfig.mysql.database}@${dbConfig.mysql.host}:${dbConfig.mysql.port}`);

  // MySQL is ready immediately (no migrations needed here - run setup_mysql_db.sql separately)
  db.ready = Promise.resolve();

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
  // Note: errors are logged automatically for debugging
  db.get = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.getAsync(sql, params).then(row => cb(null, row)).catch(err => {
      console.error('DB get error:', err.message, '| SQL:', sql.substring(0, 100));
      cb(err);
    });
  };
  db.all = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.allAsync(sql, params).then(rows => cb(null, rows)).catch(err => {
      console.error('DB all error:', err.message, '| SQL:', sql.substring(0, 100));
      cb(err);
    });
  };
  db.run = function (sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    db.runAsync(sql, params).then(result => cb(null, result)).catch(err => {
      console.error('DB run error:', err.message, '| SQL:', sql.substring(0, 100));
      cb(err);
    });
  };

  // Expose pool for special cases
  db.raw = pool;

  // Close connection pool (for graceful shutdown)
  db.close = async function () {
    try {
      await pool.end();
      console.log('MySQL connection pool closed');
    } catch (err) {
      console.error('Error closing MySQL pool:', err.message);
      throw err;
    }
  };

  // Get pool statistics for monitoring
  db.getPoolStats = function () {
    const poolInternal = pool.pool;
    return {
      activeConnections: poolInternal._allConnections.length - poolInternal._freeConnections.length,
      idleConnections: poolInternal._freeConnections.length,
      totalConnections: poolInternal._allConnections.length,
      waitingRequests: poolInternal._connectionQueue.length
    };
  };

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
// Returns a Promise that resolves when all migrations are complete
// ============================================================================
function runSQLiteMigrations(sqliteDb) {
  return new Promise((resolve, reject) => {
    // Helper to run a migration query and return a promise
    const runMigration = (sql) => {
      return new Promise((res) => {
        sqliteDb.run(sql, (err) => {
          // Log errors for CREATE TABLE (unexpected), but silently ignore ALTER TABLE
          // errors which are expected when column already exists
          if (err && !sql.includes('ALTER TABLE')) {
            console.error('Migration error:', err.message);
          }
          res(); // Always resolve - ALTER TABLE failures are expected
        });
      });
    };

    // Run all migrations sequentially using serialize to ensure order
    sqliteDb.serialize(async () => {
      try {
        // Create specialty votes tables if they don't exist
        await runMigration(`CREATE TABLE IF NOT EXISTS specialty_votes (
          specialty_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
          vote_name TEXT NOT NULL UNIQUE,
          description TEXT,
          allow_all_users BOOLEAN DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await runMigration(`CREATE TABLE IF NOT EXISTS specialty_vote_voters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          specialty_vote_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
          FOREIGN KEY (user_id) REFERENCES users (user_id),
          UNIQUE(specialty_vote_id, user_id)
        )`);

        await runMigration(`CREATE TABLE IF NOT EXISTS specialty_vote_results (
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
        await runMigration(`CREATE TABLE IF NOT EXISTS judge_scores (
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
        await runMigration(`CREATE TABLE IF NOT EXISTS published_results (
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

        // Add columns to specialty_votes if they don't exist
        await runMigration(`ALTER TABLE specialty_votes ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(vehicle_id)`);
        await runMigration(`ALTER TABLE specialty_votes ADD COLUMN class_id INTEGER REFERENCES classes(class_id)`);

        // Add registration_price column to vehicles if it doesn't exist
        await runMigration(`ALTER TABLE vehicles ADD COLUMN registration_price REAL DEFAULT 25.00`);

        // Add columns to vendor_products if they don't exist
        await runMigration(`ALTER TABLE vendor_products ADD COLUMN discount_price TEXT`);
        await runMigration(`ALTER TABLE vendor_products ADD COLUMN admin_deactivated BOOLEAN DEFAULT 0`);

        // Add admin_disabled column to vendor_business if it doesn't exist
        await runMigration(`ALTER TABLE vendor_business ADD COLUMN admin_disabled BOOLEAN DEFAULT 0`);

        // Add chat columns to users if they don't exist
        await runMigration(`ALTER TABLE users ADD COLUMN chat_enabled BOOLEAN DEFAULT 0`);
        await runMigration(`ALTER TABLE users ADD COLUMN chat_blocked BOOLEAN DEFAULT 0`);

        // Create chat_messages table
        await runMigration(`CREATE TABLE IF NOT EXISTS chat_messages (
          message_id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )`);

        console.log('SQLite migrations completed');
        resolve();
      } catch (err) {
        console.error('Migration failed:', err.message);
        reject(err);
      }
    });
  });
}

module.exports = db;
