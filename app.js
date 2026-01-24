// app.js - Complete car show voting system with authentication
const express = require('express');
const https = require('https');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cookieSession = require('cookie-session');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const port = 3001;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Session middleware
app.use(cookieSession({
  name: 'session',
  keys: ['car-show-secret-key-2024', 'backup-secret-key'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Database setup
const dbPath = path.join(__dirname, 'carshow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Check if users table is empty
function checkInitialSetup(callback) {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users:', err);
      callback(false, null);
    } else {
      callback(row.count === 0, row.count);
    }
  });
}

// Hash password
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Verify password
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Shared CSS styles - Mobile-first design
const styles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html {
      font-size: 16px;
      -webkit-text-size-adjust: 100%;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      min-height: -webkit-fill-available;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12px;
      padding-top: env(safe-area-inset-top, 12px);
      padding-bottom: env(safe-area-inset-bottom, 12px);
    }

    .container {
      background: rgba(255, 255, 255, 0.98);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      padding: 24px 20px;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
    }

    .logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .logo-icon {
      font-size: 56px;
      margin-bottom: 8px;
    }

    h1, h2 {
      color: #1a1a2e;
      text-align: center;
      margin-bottom: 8px;
      font-weight: 700;
    }

    h1 {
      font-size: 24px;
    }

    h2 {
      font-size: 20px;
    }

    .subtitle {
      color: #666;
      text-align: center;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      color: #333;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }

    input[type="text"],
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 16px;
      border: 2px solid #e1e1e1;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #f8f9fa;
      -webkit-appearance: none;
      appearance: none;
    }

    input[type="text"]:focus,
    input[type="email"]:focus,
    input[type="password"]:focus {
      border-color: #e94560;
      outline: none;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
    }

    button[type="submit"] {
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      -webkit-appearance: none;
      appearance: none;
      min-height: 54px;
    }

    button[type="submit"]:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    .error-message {
      background: #fff5f5;
      color: #e94560;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid #fed7d7;
      font-size: 14px;
      text-align: center;
    }

    .success-message {
      background: #f0fff4;
      color: #38a169;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid #c6f6d5;
      font-size: 14px;
      text-align: center;
    }

    .links {
      text-align: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e1e1e1;
    }

    .links a {
      color: #e94560;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      padding: 12px;
      display: inline-block;
      min-height: 44px;
      line-height: 20px;
    }

    .links a:active {
      opacity: 0.7;
    }

    /* Dashboard styles - Mobile optimized */
    .dashboard-container {
      max-width: 100%;
      padding: 16px;
    }

    .dashboard-header {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e1e1e1;
    }

    .dashboard-header h1 {
      text-align: center;
      font-size: 20px;
      margin-bottom: 0;
    }

    .user-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .user-avatar {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }

    .logout-btn {
      background: #f8f9fa;
      color: #666;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
      border: 2px solid #e1e1e1;
      min-height: 44px;
      display: flex;
      align-items: center;
    }

    .logout-btn:active {
      background: #e94560;
      color: white;
      border-color: #e94560;
    }

    .welcome-card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 20px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .welcome-card h2 {
      color: white;
      text-align: left;
      font-size: 22px;
      margin-bottom: 8px;
    }

    .welcome-card p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      line-height: 1.4;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .stat-card {
      background: #f8f9fa;
      padding: 20px 16px;
      border-radius: 14px;
      text-align: center;
    }

    .stat-number {
      font-size: 32px;
      font-weight: 700;
      color: #e94560;
      margin-bottom: 4px;
    }

    .stat-label {
      color: #666;
      font-size: 12px;
      font-weight: 600;
    }

    /* Tablet and larger screens */
    @media (min-width: 768px) {
      body {
        padding: 20px;
        align-items: center;
      }

      .container {
        padding: 40px;
        border-radius: 20px;
      }

      .dashboard-container {
        max-width: 900px;
        padding: 40px;
      }

      .dashboard-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      .dashboard-header h1 {
        text-align: left;
        font-size: 24px;
      }

      h1 {
        font-size: 28px;
      }

      h2 {
        font-size: 24px;
      }

      .welcome-card {
        padding: 30px;
      }

      .welcome-card h2 {
        font-size: 28px;
      }

      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 20px;
      }

      .stat-card {
        padding: 25px;
      }

      .stat-number {
        font-size: 36px;
      }

      .stat-label {
        font-size: 14px;
      }

      button[type="submit"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
      }

      .logout-btn:hover {
        background: #e94560;
        color: white;
        border-color: #e94560;
      }
    }
  </style>
`;

// Routes
app.get('/', (req, res) => {
  checkInitialSetup((isEmpty, count) => {
    if (isEmpty) {
      // Initial setup - ask for admin user
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Car Show Setup</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
              <p class="subtitle">Initial Setup - Create Admin Account</p>
            </div>
            <form method="POST" action="/create-admin">
              <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required placeholder="Enter username">
              </div>
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" name="name" required placeholder="Enter your name">
              </div>
              <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="email" required placeholder="Enter email">
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" required placeholder="Create password">
              </div>
              <div class="form-group">
                <label>Confirm Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm password">
              </div>
              <button type="submit">Create Admin Account</button>
            </form>
          </div>
        </body>
        </html>
      `);
    } else {
      // Regular login
      res.redirect('/login');
    }
  });
});

// Create admin user
app.post('/create-admin', (req, res) => {
  const { username, name, email, password, confirm_password } = req.body;

  // Check if passwords match
  if (password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Car Show Setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
            <p class="subtitle">Initial Setup - Create Admin Account</p>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <form method="POST" action="/create-admin">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required placeholder="Enter username">
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="name" required placeholder="Enter your name">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required placeholder="Enter email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required placeholder="Create password">
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" name="confirm_password" required placeholder="Confirm password">
            </div>
            <button type="submit">Create Admin Account</button>
          </form>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, hashedPassword, 'admin'],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Car Show Setup</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error creating admin user: ${err.message}</div>
              <div class="links">
                <a href="/">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Car Show Setup</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Admin account created successfully!</div>
              <p style="text-align: center; color: #666; margin-bottom: 20px;">You can now login to manage your car show.</p>
              <div class="links">
                <a href="/login">Proceed to Login</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
});

// Login page
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Car Show Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Sign in to your account</p>
        </div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create an Account</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const renderLoginError = (message) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Car Show Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Sign in to your account</p>
        </div>
        <div class="error-message">${message}</div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create an Account</a>
        </div>
      </div>
    </body>
    </html>
  `;

  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) {
      res.send(renderLoginError('Login error. Please try again.'));
      return;
    }

    if (!user) {
      res.send(renderLoginError('Invalid username or password'));
      return;
    }

    if (verifyPassword(password, user.password_hash)) {
      // Successful login
      req.session = { user: user };
      // Redirect based on role
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else if (user.role === 'judge') {
        res.redirect('/judge');
      } else if (user.role === 'registrar') {
        res.redirect('/registrar');
      } else {
        res.redirect('/user');
      }
    } else {
      res.send(renderLoginError('Invalid username or password'));
    }
  });
});

// Registration page
app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Car Show</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Create your account</p>
        </div>
        <form method="POST" action="/register">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Choose a username">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter your name">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Create password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create Account</button>
        </form>
        <div class="links">
          <a href="/login">Already have an account? Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Handle registration
app.post('/register', (req, res) => {
  const { username, name, email, phone, password, confirm_password } = req.body;

  const renderRegisterError = (message, formData = {}) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Car Show</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Create your account</p>
        </div>
        <div class="error-message">${message}</div>
        <form method="POST" action="/register">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Choose a username" value="${formData.username || ''}">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter your name" value="${formData.name || ''}">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email" value="${formData.email || ''}">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number" value="${formData.phone || ''}">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Create password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create Account</button>
        </form>
        <div class="links">
          <a href="/login">Already have an account? Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check if passwords match
  if (password !== confirm_password) {
    res.send(renderRegisterError('Passwords do not match!', { username, name, email, phone }));
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [username, name, email, phone, hashedPassword, 'user'],
    function(err) {
      if (err) {
        res.send(renderRegisterError('Error registering user: ' + err.message, { username, name, email, phone }));
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Registration Success - Car Show</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Account created successfully!</div>
              <p style="text-align: center; color: #666; margin-bottom: 20px;">Welcome to Car Show Manager. You can now sign in.</p>
              <div class="links">
                <a href="/login">Proceed to Sign In</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
});

// Admin page styles (additional) - Mobile optimized
const adminStyles = `
  <style>
    /* Mobile-first admin navigation */
    .admin-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .admin-nav a {
      flex: 1;
      min-width: calc(50% - 4px);
      padding: 14px 16px;
      background: #f8f9fa;
      border: 2px solid #e1e1e1;
      border-radius: 10px;
      text-decoration: none;
      color: #333;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .admin-nav a.active {
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      color: white;
      border-color: #e94560;
    }

    .admin-nav a:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    /* Table wrapper for horizontal scroll on mobile */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-top: 15px;
      border-radius: 10px;
      border: 1px solid #e1e1e1;
    }

    .user-table {
      width: 100%;
      min-width: 600px;
      border-collapse: collapse;
    }

    .user-table th, .user-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid #e1e1e1;
      white-space: nowrap;
      font-size: 14px;
    }

    .user-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
      position: sticky;
      top: 0;
    }

    .user-table tr:active {
      background: #f0f0f0;
    }

    /* Mobile card view for users (alternative to table) */
    .user-cards {
      display: none;
    }

    .user-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #e1e1e1;
    }

    .user-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .user-card-name {
      font-weight: 600;
      font-size: 16px;
      color: #1a1a2e;
    }

    .user-card-username {
      font-size: 13px;
      color: #666;
    }

    .user-card-details {
      font-size: 14px;
      color: #555;
      margin-bottom: 12px;
    }

    .user-card-details div {
      margin-bottom: 4px;
    }

    .user-card-badges {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .user-card-actions {
      display: flex;
      gap: 10px;
    }

    /* Larger touch targets for action buttons */
    .action-btn {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      min-width: 70px;
    }

    .action-btn.edit {
      background: #3498db;
      color: white;
    }

    .action-btn.delete {
      background: #e74c3c;
      color: white;
    }

    .action-btn:active {
      opacity: 0.8;
      transform: scale(0.98);
    }

    /* Full-width action buttons in card view */
    .user-card-actions .action-btn {
      flex: 1;
    }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    }

    .modal {
      background: white;
      padding: 24px;
      border-radius: 15px;
      max-width: 500px;
      width: 100%;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .modal h3 {
      margin-bottom: 20px;
      color: #1a1a2e;
      font-size: 18px;
    }

    .role-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      display: inline-block;
    }

    .role-badge.admin {
      background: #e94560;
      color: white;
    }

    .role-badge.judge {
      background: #3498db;
      color: white;
    }

    .role-badge.registrar {
      background: #9b59b6;
      color: white;
    }

    .role-badge.user {
      background: #27ae60;
      color: white;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
    }

    .status-badge.active {
      background: #d4edda;
      color: #155724;
    }

    .status-badge.inactive {
      background: #f8d7da;
      color: #721c24;
    }

    select {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e1e1e1;
      border-radius: 10px;
      font-size: 16px;
      background: #f8f9fa;
      cursor: pointer;
      min-height: 50px;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 16px center;
    }

    select:focus {
      border-color: #e94560;
      outline: none;
      background-color: #fff;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
      padding: 14px 24px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 16px;
      min-height: 50px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-secondary:active {
      opacity: 0.8;
    }

    .section-title {
      font-size: 18px;
      color: #1a1a2e;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e1e1e1;
    }

    .profile-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 15px;
      margin-bottom: 16px;
    }

    .profile-card h3 {
      margin-bottom: 15px;
      color: #1a1a2e;
      font-size: 16px;
    }

    /* Form buttons stacked on mobile */
    .form-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 20px;
    }

    .form-actions button,
    .form-actions a {
      width: 100%;
      text-align: center;
    }

    /* Scroll hint for tables */
    .scroll-hint {
      display: block;
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 8px;
      padding: 8px;
    }

    .scroll-hint::before {
      content: "← Scroll to see more →";
    }

    /* Tablet and up - hide card view, show table */
    @media (min-width: 768px) {
      .admin-nav a {
        flex: 0 0 auto;
        min-width: auto;
        padding: 12px 24px;
      }

      .admin-nav a:hover {
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        color: white;
        border-color: #e94560;
      }

      .table-wrapper {
        overflow-x: visible;
        border: none;
      }

      .user-table {
        min-width: 100%;
      }

      .user-table th, .user-table td {
        padding: 12px 15px;
        font-size: 14px;
      }

      .user-table tr:hover {
        background: #f8f9fa;
      }

      .action-btn {
        padding: 8px 14px;
        font-size: 13px;
        min-height: 36px;
        min-width: auto;
        margin-right: 5px;
      }

      .action-btn:hover {
        opacity: 0.85;
      }

      .scroll-hint {
        display: none;
      }

      .modal {
        padding: 30px;
      }

      .section-title {
        font-size: 20px;
      }

      .profile-card {
        padding: 25px;
      }

      .form-actions {
        flex-direction: row;
        justify-content: flex-start;
      }

      .form-actions button,
      .form-actions a {
        width: auto;
      }
    }

    /* Small phones - show card view instead of table */
    @media (max-width: 480px) {
      .table-wrapper {
        display: none;
      }

      .scroll-hint {
        display: none;
      }

      .user-cards {
        display: block;
      }

      .section-title {
        font-size: 16px;
      }
    }
  </style>
`;

// Require admin role middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require judge role middleware
function requireJudge(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'judge') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require registrar role middleware
function requireRegistrar(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'registrar') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Admin page
app.get('/admin', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.all('SELECT user_id as id, username, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
          ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
        </td>
      </tr>
    `).join('');

    // Mobile card view for small screens
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
          ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Dashboard - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Manage users, judges, and system settings.</p>
          </div>

          <div class="admin-nav">
            <a href="/admin" class="active">User Management</a>
            <a href="/admin/add-user">Add New User</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="/admin/profile">My Profile</a>
          </div>

          <h3 class="section-title">All Users</h3>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>
        </div>
      </body>
      </html>
    `);
  });
});

// Admin add user page
app.get('/admin/add-user', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Add User - Admin Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
      ${adminStyles}
    </head>
    <body>
      <div class="container dashboard-container">
        <div class="dashboard-header">
          <h1>🏎️ Admin Dashboard</h1>
          <div class="user-info">
            <div class="user-avatar">${avatarContent}</div>
            <a href="/logout" class="logout-btn">Sign Out</a>
          </div>
        </div>

        <div class="admin-nav">
          <a href="/admin">User Management</a>
          <a href="/admin/add-user" class="active">Add New User</a>
          <a href="/admin/vehicles">Vehicles</a>
          <a href="/admin/profile">My Profile</a>
        </div>

        <h3 class="section-title">Add New User</h3>
        <form method="POST" action="/admin/add-user">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter full name">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select name="role" required>
              <option value="user">User</option>
              <option value="judge">Judge</option>
              <option value="registrar">Registrar</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create User</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle admin add user
app.post('/admin/add-user', requireAdmin, (req, res) => {
  const { username, name, email, phone, role, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add User - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <div class="links">
            <a href="/admin/add-user">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [username, name, email, phone, hashedPassword, role],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Add User - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error creating user: ${err.message}</div>
              <div class="links">
                <a href="/admin/add-user">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.redirect('/admin');
      }
    });
});

// Admin edit user page
app.get('/admin/edit-user/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  db.get('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE user_id = ?', [userId], (err, editUser) => {
    if (err || !editUser) {
      res.redirect('/admin');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit User - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin">User Management</a>
            <a href="/admin/add-user">Add New User</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="/admin/profile">My Profile</a>
          </div>

          <h3 class="section-title">Edit User: ${editUser.username}</h3>
          <form method="POST" action="/admin/edit-user/${editUser.id}">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required value="${editUser.username}">
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="name" required value="${editUser.name}">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required value="${editUser.email}">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" name="phone" value="${editUser.phone || ''}">
            </div>
            <div class="form-group">
              <label>Role</label>
              <select name="role" required>
                <option value="user" ${editUser.role === 'user' ? 'selected' : ''}>User</option>
                <option value="judge" ${editUser.role === 'judge' ? 'selected' : ''}>Judge</option>
                <option value="registrar" ${editUser.role === 'registrar' ? 'selected' : ''}>Registrar</option>
                <option value="admin" ${editUser.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="is_active" required>
                <option value="1" ${editUser.is_active ? 'selected' : ''}>Active</option>
                <option value="0" ${!editUser.is_active ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
            <div class="form-group">
              <label>New Password (leave blank to keep current)</label>
              <input type="password" name="password" placeholder="Enter new password">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" name="confirm_password" placeholder="Confirm new password">
            </div>
            <button type="submit">Update User</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle admin edit user
app.post('/admin/edit-user/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { username, name, email, phone, role, is_active, password, confirm_password } = req.body;

  // Check if password change is requested
  if (password && password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit User - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <div class="links">
            <a href="/admin/edit-user/${userId}">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (password) {
    // Update with new password
    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ? WHERE user_id = ?',
      [username, name, email, phone, role, is_active, hashedPassword, userId],
      function(err) {
        if (err) {
          res.send(`<div class="error-message">Error updating user: ${err.message}</div><a href="/admin">Back</a>`);
        } else {
          res.redirect('/admin');
        }
      });
  } else {
    // Update without password change
    db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE user_id = ?',
      [username, name, email, phone, role, is_active, userId],
      function(err) {
        if (err) {
          res.send(`<div class="error-message">Error updating user: ${err.message}</div><a href="/admin">Back</a>`);
        } else {
          res.redirect('/admin');
        }
      });
  }
});

// Admin delete user
app.get('/admin/delete-user/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const currentUser = req.session.user;

  // Prevent self-deletion
  if (parseInt(userId) === currentUser.user_id) {
    res.redirect('/admin');
    return;
  }

  db.run('DELETE FROM users WHERE user_id = ?', [userId], function(err) {
    res.redirect('/admin');
  });
});

// Admin profile page
app.get('/admin/profile', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/admin');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin">User Management</a>
            <a href="/admin/add-user">Add New User</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="/admin/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/admin/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/admin/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/admin/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle admin profile photo upload
app.post('/admin/upload-photo', requireAdmin, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/admin/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/admin/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/admin/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/admin/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle admin email update
app.post('/admin/update-email', requireAdmin, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/admin/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle admin password change
app.post('/admin/change-password', requireAdmin, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/admin/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/admin/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Admin vehicles page - view all vehicles
app.get('/admin/vehicles', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all vehicles with owner info
  db.all(`SELECT c.car_id, c.make, c.model, c.class, c.description, c.image_url, c.voter_id, c.is_active, c.created_at,
          u.name as owner_name, u.username as owner_username
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          ORDER BY c.created_at DESC`, (err, cars) => {
    if (err) {
      cars = [];
    }

    const vehicleCards = cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'inactive'}">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})</div>
          <div class="vehicle-class">
            <span class="class-badge">${car.class}</span>
            <span class="status-badge ${car.is_active ? 'active' : 'inactive'}">${car.is_active ? 'Active' : 'Inactive'}</span>
            ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
          </div>
          ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
        </div>
        <div class="vehicle-actions">
          <a href="/admin/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
          <a href="/admin/delete-vehicle/${car.car_id}" class="action-btn delete" onclick="return confirm('Are you sure you want to permanently delete this vehicle?')">Delete</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Manage Vehicles - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-card.inactive {
            opacity: 0.6;
            border-style: dashed;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.active {
            background: #27ae60;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.inactive {
            background: #e74c3c;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin">User Management</a>
            <a href="/admin/add-user">Add New User</a>
            <a href="/admin/vehicles" class="active">Vehicles</a>
            <a href="/admin/profile">My Profile</a>
          </div>

          <h3 class="section-title">All Vehicles (${cars.length})</h3>

          ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
        </div>
      </body>
      </html>
    `);
  });
});

// Admin edit vehicle page
app.get('/admin/edit-vehicle/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name, u.username as owner_username
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          WHERE c.car_id = ?`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    const classOptions = ['Classic', 'Muscle', 'Sports', 'Exotic', 'Truck', 'Import', 'Modern', 'Custom', 'Other'];
    const classOptionsHtml = classOptions.map(c =>
      `<option value="${c}" ${car.class === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Vehicle - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .current-image {
            width: 100%;
            max-width: 300px;
            border-radius: 12px;
            margin-bottom: 15px;
          }
          .current-image-placeholder {
            width: 100%;
            max-width: 300px;
            height: 150px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            margin-bottom: 15px;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
          textarea {
            width: 100%;
            padding: 16px;
            border: 2px solid #e1e1e1;
            border-radius: 12px;
            font-size: 16px;
            font-family: inherit;
            resize: vertical;
            min-height: 100px;
            background: #f8f9fa;
          }
          textarea:focus {
            border-color: #e94560;
            outline: none;
            background: #fff;
          }
          .owner-info {
            background: #e8f4fd;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #2980b9;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin">User Management</a>
            <a href="/admin/add-user">Add New User</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="/admin/profile">My Profile</a>
          </div>

          <h3 class="section-title">Edit Vehicle: ${car.make} ${car.model}</h3>

          <div class="owner-info">
            <strong>Owner:</strong> ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})
          </div>

          <form method="POST" action="/admin/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
            <div class="profile-card">
              <div class="form-group">
                <label>Make *</label>
                <input type="text" name="make" required value="${car.make}">
              </div>
              <div class="form-group">
                <label>Model *</label>
                <input type="text" name="model" required value="${car.model}">
              </div>
              <div class="form-group">
                <label>Class *</label>
                <select name="class" required>
                  ${classOptionsHtml}
                </select>
              </div>
              <div class="form-group">
                <label>Voter ID</label>
                <input type="text" name="voter_id" value="${car.voter_id || ''}" placeholder="Assigned voter number">
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="1" ${car.is_active ? 'selected' : ''}>Active</option>
                  <option value="0" ${!car.is_active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea name="description" placeholder="Vehicle description...">${car.description || ''}</textarea>
              </div>
              <div class="form-group">
                <label>Vehicle Photo</label>
                ${car.image_url
                  ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" class="current-image">`
                  : `<div class="current-image-placeholder">🚗</div>`
                }
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    ${car.image_url ? 'Upload new image to replace current' : 'Click or tap to select an image'}<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Update Vehicle</button>
            </div>
          </form>

          <script>
            function updateFileName(input) {
              const fileName = document.getElementById('fileName');
              const wrapper = document.getElementById('fileWrapper');
              if (input.files && input.files[0]) {
                fileName.textContent = 'Selected: ' + input.files[0].name;
                wrapper.classList.add('has-file');
              } else {
                fileName.textContent = '';
                wrapper.classList.remove('has-file');
              }
            }
          </script>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle admin vehicle update
app.post('/admin/edit-vehicle/:id', requireAdmin, upload.single('vehicle_photo'), async (req, res) => {
  const carId = req.params.id;
  const { make, model, class: vehicleClass, voter_id, is_active, description } = req.body;

  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ?', [carId], async (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    let imageUrl = car.image_url;

    if (req.file) {
      try {
        const randomName = crypto.randomBytes(16).toString('hex');
        const filename = `${randomName}.jpg`;
        const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
        imageUrl = `/images/user_uploads/cars/${filename}`;

        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 600, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toFile(filepath);

        if (car.image_url) {
          const oldPath = path.join(__dirname, car.image_url);
          fs.unlink(oldPath, () => {});
        }
      } catch (error) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error processing image: ${error.message}</div>
              <div class="links">
                <a href="/admin/edit-vehicle/${carId}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    db.run('UPDATE cars SET make = ?, model = ?, class = ?, voter_id = ?, is_active = ?, description = ?, image_url = ? WHERE car_id = ?',
      [make, model, vehicleClass, voter_id || null, is_active, description || null, imageUrl, carId],
      function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Update Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error updating vehicle: ${err.message}</div>
                <div class="links">
                  <a href="/admin/edit-vehicle/${carId}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          res.redirect('/admin/vehicles');
        }
      });
  });
});

// Admin delete vehicle
app.get('/admin/delete-vehicle/:id', requireAdmin, (req, res) => {
  const carId = req.params.id;

  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ?', [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    db.run('DELETE FROM cars WHERE car_id = ?', [carId], function(err) {
      if (!err && car.image_url) {
        const imagePath = path.join(__dirname, car.image_url);
        fs.unlink(imagePath, () => {});
      }
      res.redirect('/admin/vehicles');
    });
  });
});

// Judge page
app.get('/judge', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all non-admin users
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active, created_at FROM users WHERE role != ? ORDER BY role, name', ['admin'], (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Judge Dashboard - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, Judge ${user.name}!</h2>
            <p>Review and score car show entries, and help users with password resets.</p>
          </div>

          <div class="admin-nav">
            <a href="/judge" class="active">Dashboard</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">0</div>
              <div class="stat-label">Cars to Judge</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">0</div>
              <div class="stat-label">Scores Submitted</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${users.length}</div>
              <div class="stat-label">Users & Judges</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Judge view users page
app.get('/judge/users', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all non-admin users
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active, created_at FROM users WHERE role != ? ORDER BY role, name', ['admin'], (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </td>
      </tr>
    `).join('');

    // Mobile card view
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
          ${u.phone ? `<div>${u.phone}</div>` : ''}
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>View Users - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users" class="active">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Users & Judges</h3>
          <p style="color: #666; margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and other judges. Admin accounts are not shown.</p>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>
        </div>
      </body>
      </html>
    `);
  });
});

// Judge reset password page
app.get('/judge/reset-password/:id', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  // Get the user but only if they're not an admin
  db.get('SELECT user_id as id, username, name, role FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/judge/users');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Reset Password for: ${targetUser.name}</h3>
          <div class="profile-card">
            <p style="margin-bottom: 15px;"><strong>Username:</strong> ${targetUser.username}</p>
            <p style="margin-bottom: 20px;"><strong>Role:</strong> <span class="role-badge ${targetUser.role}">${targetUser.role}</span></p>

            <form method="POST" action="/judge/reset-password/${targetUser.id}">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Reset Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle judge password reset
app.post('/judge/reset-password/:id', requireJudge, (req, res) => {
  const userId = req.params.id;
  const { password, confirm_password } = req.body;

  // First verify the target user is not an admin
  db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/judge/users');
      return;
    }

    if (password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reset Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Passwords do not match!</div>
            <div class="links">
              <a href="/judge/reset-password/${userId}">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role != ?', [hashedPassword, userId, 'admin'], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Reset Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error resetting password: ${err.message}</div>
              <div class="links">
                <a href="/judge/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Reset</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password reset successfully for ${targetUser.name}!</div>
              <div class="links">
                <a href="/judge/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Judge profile page
app.get('/judge/profile', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/judge');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/judge/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/judge/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/judge/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle judge profile photo upload
app.post('/judge/upload-photo', requireJudge, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/judge/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/judge/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/judge/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/judge/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle judge email update
app.post('/judge/update-email', requireJudge, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/judge/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle judge password change
app.post('/judge/change-password', requireJudge, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/judge/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/judge/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Judge vehicles page - view and change class
app.get('/judge/vehicles', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all active vehicles with owner info
  db.all(`SELECT c.car_id, c.make, c.model, c.class, c.description, c.image_url, c.voter_id,
          u.name as owner_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          WHERE c.is_active = 1
          ORDER BY c.class, c.make, c.model`, (err, cars) => {
    if (err) {
      cars = [];
    }

    const vehicleCards = cars.map(car => `
      <div class="vehicle-card">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
          <div class="vehicle-class">
            <span class="class-badge">${car.class}</span>
            ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
          </div>
          ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
        </div>
        <div class="vehicle-actions">
          <a href="/judge/edit-vehicle/${car.car_id}" class="action-btn edit">Change Class</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicles - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/vehicles" class="active">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Active Vehicles (${cars.length})</h3>

          ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No active vehicles to judge.</p>'}
        </div>
      </body>
      </html>
    `);
  });
});

// Judge edit vehicle class page
app.get('/judge/edit-vehicle/:id', requireJudge, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          WHERE c.car_id = ? AND c.is_active = 1`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/judge/vehicles');
      return;
    }

    const classOptions = ['Classic', 'Muscle', 'Sports', 'Exotic', 'Truck', 'Import', 'Modern', 'Custom', 'Other'];
    const classOptionsHtml = classOptions.map(c =>
      `<option value="${c}" ${car.class === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Change Vehicle Class - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-preview {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 20px;
          }
          .vehicle-preview-image {
            width: 100%;
            max-width: 300px;
            height: 200px;
            border-radius: 12px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-preview-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-preview-placeholder {
            width: 100%;
            max-width: 300px;
            height: 200px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
          }
          .vehicle-preview-info h4 {
            font-size: 20px;
            margin-bottom: 8px;
            color: #1a1a2e;
          }
          .vehicle-preview-info p {
            color: #666;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Change Vehicle Class</h3>

          <div class="vehicle-preview">
            ${car.image_url
              ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
              : `<div class="vehicle-preview-placeholder">🚗</div>`
            }
            <div class="vehicle-preview-info">
              <h4>${car.make} ${car.model}</h4>
              <p><strong>Owner:</strong> ${car.owner_name || 'Unknown'}</p>
              ${car.description ? `<p>${car.description}</p>` : ''}
            </div>
          </div>

          <form method="POST" action="/judge/edit-vehicle/${car.car_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Current Class</label>
                <input type="text" value="${car.class}" disabled>
              </div>
              <div class="form-group">
                <label>New Class</label>
                <select name="class" required>
                  ${classOptionsHtml}
                </select>
              </div>
              <button type="submit">Update Class</button>
            </div>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle judge vehicle class update
app.post('/judge/edit-vehicle/:id', requireJudge, (req, res) => {
  const carId = req.params.id;
  const { class: vehicleClass } = req.body;

  db.run('UPDATE cars SET class = ? WHERE car_id = ? AND is_active = 1', [vehicleClass, carId], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating vehicle class: ${err.message}</div>
            <div class="links">
              <a href="/judge/vehicles">Back to Vehicles</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.redirect('/judge/vehicles');
    }
  });
});

// Registrar dashboard page
app.get('/registrar', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get count of users for stats
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role = ? ORDER BY name', ['user'], (err, users) => {
    if (err) {
      users = [];
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registrar Dashboard - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Handle participant check-in and registration tasks.</p>
          </div>

          <div class="admin-nav">
            <a href="/registrar" class="active">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${users.length}</div>
              <div class="stat-label">Registered Users</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">0</div>
              <div class="stat-label">Checked In</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Registrar view users page
app.get('/registrar/users', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all users (not admins)
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role NOT IN (?, ?) ORDER BY name', ['admin', 'registrar'], (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </td>
      </tr>
    `).join('');

    // Mobile card view
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
          ${u.phone ? `<div>${u.phone}</div>` : ''}
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>View Users - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users" class="active">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">Users & Judges</h3>
          <p style="color: #666; margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and judges.</p>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>
        </div>
      </body>
      </html>
    `);
  });
});

// Registrar reset password page
app.get('/registrar/reset-password/:id', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  // Get the user but only if they're not an admin or registrar
  db.get('SELECT user_id as id, username, name, role FROM users WHERE user_id = ? AND role NOT IN (?, ?)', [userId, 'admin', 'registrar'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/registrar/users');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">Reset Password for: ${targetUser.name}</h3>
          <div class="profile-card">
            <p style="margin-bottom: 15px;"><strong>Username:</strong> ${targetUser.username}</p>
            <p style="margin-bottom: 20px;"><strong>Role:</strong> <span class="role-badge ${targetUser.role}">${targetUser.role}</span></p>

            <form method="POST" action="/registrar/reset-password/${targetUser.id}">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Reset Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle registrar password reset
app.post('/registrar/reset-password/:id', requireRegistrar, (req, res) => {
  const userId = req.params.id;
  const { password, confirm_password } = req.body;

  // First verify the target user is not an admin or registrar
  db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role NOT IN (?, ?)', [userId, 'admin', 'registrar'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/registrar/users');
      return;
    }

    if (password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reset Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Passwords do not match!</div>
            <div class="links">
              <a href="/registrar/reset-password/${userId}">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role NOT IN (?, ?)', [hashedPassword, userId, 'admin', 'registrar'], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Reset Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error resetting password: ${err.message}</div>
              <div class="links">
                <a href="/registrar/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Reset</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password reset successfully for ${targetUser.name}!</div>
              <div class="links">
                <a href="/registrar/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Registrar profile page
app.get('/registrar/profile', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/registrar');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/registrar/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/registrar/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/registrar/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle registrar profile photo upload
app.post('/registrar/upload-photo', requireRegistrar, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/registrar/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/registrar/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/registrar/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/registrar/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle registrar email update
app.post('/registrar/update-email', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/registrar/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle registrar password change
app.post('/registrar/change-password', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/registrar/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/registrar/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Registrar vehicles page - manage voter_id and is_active
app.get('/registrar/vehicles', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all vehicles with owner info
  db.all(`SELECT c.car_id, c.make, c.model, c.class, c.description, c.image_url, c.voter_id, c.is_active,
          u.name as owner_name, u.username as owner_username
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          ORDER BY c.is_active ASC, c.created_at DESC`, (err, cars) => {
    if (err) {
      cars = [];
    }

    const pendingCount = cars.filter(c => !c.is_active).length;
    const activeCount = cars.filter(c => c.is_active).length;

    const vehicleCards = cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'pending'}">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})</div>
          <div class="vehicle-class">
            <span class="class-badge">${car.class}</span>
            <span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending Payment'}</span>
            ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
          </div>
        </div>
        <div class="vehicle-actions">
          <a href="/registrar/edit-vehicle/${car.car_id}" class="action-btn edit">${car.is_active ? 'Edit' : 'Activate'}</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicles - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-card.pending {
            border: 2px dashed #f39c12;
            background: #fffbf0;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.active {
            background: #27ae60;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.pending {
            background: #f39c12;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
          }
          .summary-card.pending-bg {
            background: #fffbf0;
            border: 1px solid #f39c12;
          }
          .summary-number {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a2e;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles" class="active">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <div class="summary-cards">
            <div class="summary-card pending-bg">
              <div class="summary-number">${pendingCount}</div>
              <div class="summary-label">Pending Payment</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">${activeCount}</div>
              <div class="summary-label">Active Vehicles</div>
            </div>
          </div>

          <h3 class="section-title">All Vehicles (${cars.length})</h3>

          ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
        </div>
      </body>
      </html>
    `);
  });
});

// Registrar edit vehicle page - voter_id and is_active
app.get('/registrar/edit-vehicle/:id', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name, u.username as owner_username, u.email as owner_email, u.phone as owner_phone
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          WHERE c.car_id = ?`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/registrar/vehicles');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Vehicle - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-preview {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 20px;
          }
          .vehicle-preview-image {
            width: 100%;
            max-width: 300px;
            height: 200px;
            border-radius: 12px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-preview-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-preview-placeholder {
            width: 100%;
            max-width: 300px;
            height: 200px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
          }
          .vehicle-preview-info h4 {
            font-size: 20px;
            margin-bottom: 8px;
            color: #1a1a2e;
          }
          .vehicle-preview-info p {
            color: #666;
            margin-bottom: 4px;
            font-size: 14px;
          }
          .owner-details {
            background: #e8f4fd;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 20px;
          }
          .owner-details h4 {
            color: #2980b9;
            margin-bottom: 10px;
          }
          .owner-details p {
            margin: 4px 0;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">${car.is_active ? 'Edit' : 'Activate'} Vehicle</h3>

          <div class="vehicle-preview">
            ${car.image_url
              ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
              : `<div class="vehicle-preview-placeholder">🚗</div>`
            }
            <div class="vehicle-preview-info">
              <h4>${car.make} ${car.model}</h4>
              <p><strong>Class:</strong> ${car.class}</p>
              ${car.description ? `<p>${car.description}</p>` : ''}
            </div>
          </div>

          <div class="owner-details">
            <h4>Owner Information</h4>
            <p><strong>Name:</strong> ${car.owner_name || 'Unknown'}</p>
            <p><strong>Username:</strong> @${car.owner_username || 'N/A'}</p>
            <p><strong>Email:</strong> ${car.owner_email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${car.owner_phone || 'N/A'}</p>
          </div>

          <form method="POST" action="/registrar/edit-vehicle/${car.car_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Voter ID Number</label>
                <input type="text" name="voter_id" value="${car.voter_id || ''}" placeholder="Assign a voter number">
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="0" ${!car.is_active ? 'selected' : ''}>Inactive (Pending Payment)</option>
                  <option value="1" ${car.is_active ? 'selected' : ''}>Active (Payment Received)</option>
                </select>
              </div>
              <button type="submit">${car.is_active ? 'Update Vehicle' : 'Activate Vehicle'}</button>
            </div>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle registrar vehicle update
app.post('/registrar/edit-vehicle/:id', requireRegistrar, (req, res) => {
  const carId = req.params.id;
  const { voter_id, is_active } = req.body;

  db.run('UPDATE cars SET voter_id = ?, is_active = ? WHERE car_id = ?', [voter_id || null, is_active, carId], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating vehicle: ${err.message}</div>
            <div class="links">
              <a href="/registrar/vehicles">Back to Vehicles</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.redirect('/registrar/vehicles');
    }
  });
});

// User page
app.get('/user', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get user's registered vehicles (both active and pending)
  db.all('SELECT car_id, make, model, class, description, image_url, is_active FROM cars WHERE user_id = ? ORDER BY created_at DESC', [user.user_id], (err, cars) => {
    if (err) {
      cars = [];
    }

    const vehicleCards = cars.length > 0 ? cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'pending'}">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-class">
            <span class="class-badge">${car.class}</span>
            ${car.is_active ? '' : '<span class="status-badge pending">Pending Approval</span>'}
          </div>
          ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
        </div>
        <div class="vehicle-actions">
          <a href="/user/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
        </div>
      </div>
    `).join('') : '<p style="color: #666; text-align: center; padding: 20px;">You haven\'t registered any vehicles yet.</p>';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Account - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-image {
            width: 100%;
            height: 150px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 8px;
          }
          .vehicle-class {
            margin-bottom: 8px;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 14px;
            color: #666;
            line-height: 1.4;
          }
          .vehicle-actions {
            display: flex;
            gap: 10px;
          }
          .register-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            margin-top: 20px;
          }
          .register-btn:active {
            opacity: 0.9;
            transform: scale(0.98);
          }
          .vehicle-card.pending {
            opacity: 0.7;
            border-style: dashed;
          }
          .status-badge.pending {
            background: #f39c12;
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 8px;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 200px;
              height: 120px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
            .register-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 30px rgba(39, 174, 96, 0.4);
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Show Manager</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Manage your registered vehicles for the car show.</p>
          </div>

          <div class="admin-nav">
            <a href="/user" class="active">My Vehicles</a>
            <a href="/user/profile">My Profile</a>
          </div>

          <h3 class="section-title">My Registered Vehicles (${cars.length})</h3>

          ${vehicleCards}

          <a href="/user/register-vehicle" class="register-btn">+ Register New Vehicle</a>
        </div>
      </body>
      </html>
    `);
  });
});

// User profile page
app.get('/user/profile', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/user');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Show Manager</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/user">Dashboard</a>
            <a href="/user/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/user/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/user/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/user/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle profile photo upload
app.post('/user/upload-photo', requireAuth, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/user/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    // Generate random filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    // Process and resize image with sharp
    // .rotate() with no arguments auto-rotates based on EXIF orientation
    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Get old image to delete if exists
    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        // Delete old image file
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {}); // Ignore errors if file doesn't exist
      }

      // Update database with new image URL
      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/user/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          // Update session with new image URL
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/user/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/user/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle user email update
app.post('/user/update-email', requireAuth, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      // Update session
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/user/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle user password change
app.post('/user/change-password', requireAuth, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  // Get current password hash
  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Verify current password
    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Check new passwords match
    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Update password
    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/user/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/user/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Register new vehicle page
app.get('/user/register-vehicle', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register Vehicle - Car Show Manager</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
      ${adminStyles}
      <style>
        .file-input-wrapper {
          position: relative;
          overflow: hidden;
          display: inline-block;
          width: 100%;
        }
        .file-input-wrapper input[type=file] {
          position: absolute;
          left: 0;
          top: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        .file-input-label {
          display: block;
          padding: 14px 16px;
          background: #f8f9fa;
          border: 2px dashed #e1e1e1;
          border-radius: 12px;
          text-align: center;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .file-input-wrapper:hover .file-input-label {
          border-color: #e94560;
          background: #fff5f7;
        }
        .file-input-wrapper.has-file .file-input-label {
          border-color: #27ae60;
          background: rgba(39, 174, 96, 0.1);
          color: #27ae60;
        }
        .file-name {
          margin-top: 8px;
          font-size: 13px;
          color: #27ae60;
          text-align: center;
          font-weight: 600;
        }
        textarea {
          width: 100%;
          padding: 16px;
          border: 2px solid #e1e1e1;
          border-radius: 12px;
          font-size: 16px;
          font-family: inherit;
          resize: vertical;
          min-height: 100px;
          background: #f8f9fa;
        }
        textarea:focus {
          border-color: #e94560;
          outline: none;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
        }
      </style>
    </head>
    <body>
      <div class="container dashboard-container">
        <div class="dashboard-header">
          <h1>🏎️ Car Show Manager</h1>
          <div class="user-info">
            <div class="user-avatar">${avatarContent}</div>
            <a href="/logout" class="logout-btn">Sign Out</a>
          </div>
        </div>

        <div class="admin-nav">
          <a href="/user">My Vehicles</a>
          <a href="/user/profile">My Profile</a>
        </div>

        <h3 class="section-title">Register New Vehicle</h3>

        <form method="POST" action="/user/register-vehicle" enctype="multipart/form-data">
          <div class="profile-card">
            <div class="form-group">
              <label>Make *</label>
              <input type="text" name="make" required placeholder="e.g., Ford, Chevrolet, Toyota">
            </div>
            <div class="form-group">
              <label>Model *</label>
              <input type="text" name="model" required placeholder="e.g., Mustang, Camaro, Supra">
            </div>
            <div class="form-group">
              <label>Class *</label>
              <select name="class" required>
                <option value="">Select a class...</option>
                <option value="Classic">Classic (Pre-1970)</option>
                <option value="Muscle">Muscle Car</option>
                <option value="Sports">Sports Car</option>
                <option value="Exotic">Exotic/Supercar</option>
                <option value="Truck">Truck/SUV</option>
                <option value="Import">Import/Tuner</option>
                <option value="Modern">Modern (2010+)</option>
                <option value="Custom">Custom/Modified</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Description (Optional)</label>
              <textarea name="description" placeholder="Tell us about your vehicle... year, special features, history, etc."></textarea>
            </div>
            <div class="form-group">
              <label>Vehicle Photo (Optional)</label>
              <div class="file-input-wrapper" id="fileWrapper">
                <div class="file-input-label">
                  Click or tap to select an image<br>
                  <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                </div>
                <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
              </div>
              <div class="file-name" id="fileName"></div>
            </div>
            <button type="submit">Register Vehicle</button>
          </div>
        </form>
        <script>
          function updateFileName(input) {
            const fileName = document.getElementById('fileName');
            const wrapper = document.getElementById('fileWrapper');
            if (input.files && input.files[0]) {
              fileName.textContent = 'Selected: ' + input.files[0].name;
              wrapper.classList.add('has-file');
            } else {
              fileName.textContent = '';
              wrapper.classList.remove('has-file');
            }
          }
        </script>
      </div>
    </body>
    </html>
  `);
});

// Handle vehicle registration
app.post('/user/register-vehicle', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
  const user = req.session.user;
  const { make, model, class: vehicleClass, description } = req.body;

  let imageUrl = null;

  // Process image if uploaded
  if (req.file) {
    try {
      const randomName = crypto.randomBytes(16).toString('hex');
      const filename = `${randomName}.jpg`;
      const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
      imageUrl = `/images/user_uploads/cars/${filename}`;

      await sharp(req.file.buffer)
        .rotate()
        .resize(800, 600, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toFile(filepath);
    } catch (error) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error processing image: ${error.message}</div>
            <div class="links">
              <a href="/user/register-vehicle">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }
  }

  // Insert vehicle into database - is_active=0 by default until registrar enables after payment
  db.run('INSERT INTO cars (make, model, class, description, image_url, user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [make, model, vehicleClass, description || null, imageUrl, user.user_id],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Registration Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error registering vehicle: ${err.message}</div>
              <div class="links">
                <a href="/user/register-vehicle">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vehicle Registered</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Your ${make} ${model} has been registered successfully!</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
});

// Edit vehicle page
app.get('/user/edit-vehicle/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get the vehicle - make sure it belongs to this user (include pending vehicles)
  db.get('SELECT car_id, make, model, class, description, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    const classOptions = ['Classic', 'Muscle', 'Sports', 'Exotic', 'Truck', 'Import', 'Modern', 'Custom', 'Other'];
    const classOptionsHtml = classOptions.map(c =>
      `<option value="${c}" ${car.class === c ? 'selected' : ''}>${c}${c === 'Classic' ? ' (Pre-1970)' : c === 'Muscle' ? ' Car' : c === 'Sports' ? ' Car' : c === 'Exotic' ? '/Supercar' : c === 'Truck' ? '/SUV' : c === 'Import' ? '/Tuner' : c === 'Modern' ? ' (2010+)' : c === 'Custom' ? '/Modified' : ''}</option>`
    ).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Vehicle - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .current-image {
            width: 100%;
            max-width: 300px;
            border-radius: 12px;
            margin-bottom: 15px;
          }
          .current-image-placeholder {
            width: 100%;
            max-width: 300px;
            height: 150px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            margin-bottom: 15px;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
          textarea {
            width: 100%;
            padding: 16px;
            border: 2px solid #e1e1e1;
            border-radius: 12px;
            font-size: 16px;
            font-family: inherit;
            resize: vertical;
            min-height: 100px;
            background: #f8f9fa;
          }
          textarea:focus {
            border-color: #e94560;
            outline: none;
            background: #fff;
            box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
          }
          .delete-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: #e74c3c;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            margin-top: 10px;
            border: none;
            cursor: pointer;
          }
          .delete-btn:active {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Show Manager</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/user">My Vehicles</a>
            <a href="/user/profile">My Profile</a>
          </div>

          <h3 class="section-title">Edit Vehicle: ${car.make} ${car.model}</h3>

          <form method="POST" action="/user/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
            <div class="profile-card">
              <div class="form-group">
                <label>Make *</label>
                <input type="text" name="make" required value="${car.make}">
              </div>
              <div class="form-group">
                <label>Model *</label>
                <input type="text" name="model" required value="${car.model}">
              </div>
              <div class="form-group">
                <label>Class *</label>
                <select name="class" required>
                  ${classOptionsHtml}
                </select>
              </div>
              <div class="form-group">
                <label>Description (Optional)</label>
                <textarea name="description" placeholder="Tell us about your vehicle...">${car.description || ''}</textarea>
              </div>
              <div class="form-group">
                <label>Vehicle Photo</label>
                ${car.image_url
                  ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" class="current-image">`
                  : `<div class="current-image-placeholder">🚗</div>`
                }
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    ${car.image_url ? 'Upload new image to replace current' : 'Click or tap to select an image'}<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
              </div>
              <button type="submit">Update Vehicle</button>
            </div>
          </form>

          <form method="POST" action="/user/delete-vehicle/${car.car_id}" onsubmit="return confirm('Are you sure you want to remove this vehicle from the show?');">
            <button type="submit" class="delete-btn">Remove Vehicle</button>
          </form>

          <script>
            function updateFileName(input) {
              const fileName = document.getElementById('fileName');
              const wrapper = document.getElementById('fileWrapper');
              if (input.files && input.files[0]) {
                fileName.textContent = 'Selected: ' + input.files[0].name;
                wrapper.classList.add('has-file');
              } else {
                fileName.textContent = '';
                wrapper.classList.remove('has-file');
              }
            }
          </script>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle vehicle update
app.post('/user/edit-vehicle/:id', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const { make, model, class: vehicleClass, description } = req.body;

  // First verify the car belongs to this user (include pending vehicles)
  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], async (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    let imageUrl = car.image_url;

    // Process new image if uploaded
    if (req.file) {
      try {
        const randomName = crypto.randomBytes(16).toString('hex');
        const filename = `${randomName}.jpg`;
        const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
        imageUrl = `/images/user_uploads/cars/${filename}`;

        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 600, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85 })
          .toFile(filepath);

        // Delete old image if exists
        if (car.image_url) {
          const oldPath = path.join(__dirname, car.image_url);
          fs.unlink(oldPath, () => {});
        }
      } catch (error) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error processing image: ${error.message}</div>
              <div class="links">
                <a href="/user/edit-vehicle/${carId}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    // Update vehicle in database
    db.run('UPDATE cars SET make = ?, model = ?, class = ?, description = ?, image_url = ? WHERE car_id = ? AND user_id = ?',
      [make, model, vehicleClass, description || null, imageUrl, carId, user.user_id],
      function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Update Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error updating vehicle: ${err.message}</div>
                <div class="links">
                  <a href="/user/edit-vehicle/${carId}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Vehicle Updated</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Your ${make} ${model} has been updated successfully!</div>
                <div class="links">
                  <a href="/user">Back to My Vehicles</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
  });
});

// Handle vehicle deletion (hard delete for users)
app.post('/user/delete-vehicle/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;

  // First get the vehicle to delete its image
  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    // Delete the vehicle
    db.run('DELETE FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Delete Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error removing vehicle: ${err.message}</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Delete the image file if exists
        if (car.image_url) {
          const imagePath = path.join(__dirname, car.image_url);
          fs.unlink(imagePath, () => {});
        }

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vehicle Deleted</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Vehicle has been deleted.</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Legacy dashboard redirect
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role === 'admin') {
    res.redirect('/admin');
  } else if (user.role === 'judge') {
    res.redirect('/judge');
  } else if (user.role === 'registrar') {
    res.redirect('/registrar');
  } else {
    res.redirect('/user');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// HTTPS server with self-signed certificate
const options = {
  key: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/key.pem'),
  cert:
fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/cert.pem')
};

https.createServer(options, app).listen(port, () => {
  console.log(`Car Show Voting App listening at https://localhost:${port}`);
  console.log('Note: You may see a security warning in your browser - this is expected for self-signed certificates');
});

console.log('To access the application:');
console.log('1. Open your browser and go to: https://localhost:3001');
console.log('2. You will see a security warning - accept it to continue');

