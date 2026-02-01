/**
 * Public Routes Module
 *
 * Handles all public (non-role-specific) routes including initial setup,
 * admin creation, admin recovery, login, registration, dashboard redirect,
 * and logout.
 */

const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload, port) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const { requireAuth, hashPassword, verifyPassword, checkInitialSetup } = require('../middleware/auth');
  const { errorPage, successPage, formPage } = require('../views/layout');
  const styles = `<link rel="stylesheet" href="/css/styles.css">`;

  // Generate dynamic login background styles from config
  function getLoginBackgroundStyles() {
    const bg = appConfig.loginBackground || {};
    const useImage = bg.useImage && bg.imageUrl;
    const bgColor = bg.backgroundColor || '#1a1a2e';
    const cardOpacity = bg.cardOpacity ?? 0.98;
    const useTint = bg.useTint;
    const tintColor = bg.tintColor || '#1a1a2e';
    const tintOpacity = bg.tintOpacity ?? 0.5;

    let bodyBg;
    if (useImage) {
      bodyBg = `background: url('${bg.imageUrl}') center/cover no-repeat fixed; background-color: #1a1a2e;`;
    } else {
      bodyBg = `background: ${bgColor};`;
    }

    let tintStyles = '';
    if (useImage && useTint) {
      tintStyles = `
        body::before {
          content: '';
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: ${tintColor};
          opacity: ${tintOpacity};
          z-index: 0;
          pointer-events: none;
        }
        body > .container { position: relative; z-index: 1; }
      `;
    }

    return `
      <style>
        body { ${bodyBg} }
        .container:not(.dashboard-container) { background: rgba(255, 255, 255, ${cardOpacity}); }
        ${tintStyles}
      </style>
    `;
  }

  // ============================================================
  // Initial Setup Check - GET /
  // ============================================================
  router.get('/', (req, res) => {
    checkInitialSetup(db, (isEmpty, count) => {
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

  // ============================================================
  // Create Admin Account - POST /create-admin
  // ============================================================
  router.post('/create-admin', (req, res) => {
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
          console.error('Admin creation error:', err.message);
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
                <div class="error-message">Error creating admin account. Please try again.</div>
                <div class="links">
                  <a href="/">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          // Generate recovery token for admin password recovery
          const recoveryToken = crypto.randomBytes(32).toString('hex');
          const recoveryTokenHash = crypto.createHash('sha256').update(recoveryToken).digest('hex');

          // Save the hashed token to a file
          const recoveryFilePath = path.join(__dirname, '..', 'admin_recovery_token.txt');
          fs.writeFileSync(recoveryFilePath, recoveryTokenHash, 'utf8');

          // Build the recovery URL
          const recoveryUrl = `https://localhost:${port}/admin/recover?token=${recoveryToken}`;

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Car Show Setup</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              <style>
                .recovery-modal {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.8);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  z-index: 1000;
                }
                .recovery-modal-content {
                  background: white;
                  padding: 30px;
                  border-radius: 12px;
                  max-width: 90%;
                  width: 500px;
                  text-align: center;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }
                .recovery-modal h2 {
                  color: #e74c3c;
                  margin-bottom: 15px;
                }
                .recovery-modal p {
                  color: #333;
                  margin-bottom: 20px;
                  line-height: 1.6;
                }
                .recovery-url-box {
                  background: #f8f9fa;
                  border: 2px solid #e74c3c;
                  border-radius: 8px;
                  padding: 15px;
                  margin: 20px 0;
                  word-break: break-all;
                  font-family: monospace;
                  font-size: 12px;
                  color: #333;
                  text-align: left;
                }
                .copy-btn {
                  background: #3498db;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 6px;
                  cursor: pointer;
                  margin-right: 10px;
                  font-size: 14px;
                }
                .copy-btn:hover {
                  background: #2980b9;
                }
                .proceed-btn {
                  background: #27ae60;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  text-decoration: none;
                  display: inline-block;
                }
                .proceed-btn:hover {
                  background: #219a52;
                }
                .warning-icon {
                  font-size: 48px;
                  margin-bottom: 15px;
                }
              </style>
            </head>
            <body>
              <div class="recovery-modal">
                <div class="recovery-modal-content">
                  <div class="warning-icon">⚠️</div>
                  <h2>IMPORTANT: Save This Recovery URL!</h2>
                  <p>Your admin account has been created successfully. Below is your <strong>one-time recovery URL</strong>. If you ever forget your admin password, you can use this URL to create a new admin account.</p>
                  <p><strong style="color: #e74c3c;">Save this URL in a safe location NOW. You will NOT see it again!</strong></p>
                  <div class="recovery-url-box" id="recoveryUrl">${recoveryUrl}</div>
                  <div style="margin-top: 20px;">
                    <button class="copy-btn" onclick="copyUrl()">📋 Copy URL</button>
                    <a href="/login" class="proceed-btn">✓ I've Saved It - Proceed to Login</a>
                  </div>
                </div>
              </div>
              <script>
                function copyUrl() {
                  const urlText = document.getElementById('recoveryUrl').innerText;
                  navigator.clipboard.writeText(urlText).then(() => {
                    alert('Recovery URL copied to clipboard!');
                  }).catch(() => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = urlText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Recovery URL copied to clipboard!');
                  });
                }
              </script>
            </body>
            </html>
          `);
        }
      });
  });

  // ============================================================
  // Admin Account Recovery - GET /admin/recover
  // ============================================================
  router.get('/admin/recover', (req, res) => {
    const { token } = req.query;

    if (!token) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">No recovery token provided.</div>
            <div class="links">
              <a href="/login">Return to Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Read the saved token hash from file
    const recoveryFilePath = path.join(__dirname, '..', 'admin_recovery_token.txt');

    if (!fs.existsSync(recoveryFilePath)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Recovery token not configured. Please contact system administrator.</div>
            <div class="links">
              <a href="/login">Return to Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const savedTokenHash = fs.readFileSync(recoveryFilePath, 'utf8').trim();
    const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (savedTokenHash !== providedTokenHash) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Invalid recovery token. Access denied.</div>
            <div class="links">
              <a href="/login">Return to Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Token is valid - show admin creation form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
            <p class="subtitle">Admin Account Recovery</p>
          </div>
          <div class="success-message" style="background: #fff3cd; color: #856404; border-color: #ffeeba;">
            Recovery token validated. Create a new admin account below.
          </div>
          <form method="POST" action="/admin/recover">
            <input type="hidden" name="token" value="${token}">
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
            <button type="submit">Create New Admin Account</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });

  // ============================================================
  // Admin Account Recovery - POST /admin/recover
  // ============================================================
  router.post('/admin/recover', (req, res) => {
    const { token, username, name, email, password, confirm_password } = req.body;

    // Verify token again
    const recoveryFilePath = path.join(__dirname, '..', 'admin_recovery_token.txt');

    if (!token || !fs.existsSync(recoveryFilePath)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Invalid recovery request.</div>
            <div class="links">
              <a href="/login">Return to Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const savedTokenHash = fs.readFileSync(recoveryFilePath, 'utf8').trim();
    const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (savedTokenHash !== providedTokenHash) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Invalid recovery token. Access denied.</div>
            <div class="links">
              <a href="/login">Return to Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Check if passwords match
    if (password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Recovery</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
              <p class="subtitle">Admin Account Recovery</p>
            </div>
            <div class="error-message">Passwords do not match!</div>
            <form method="POST" action="/admin/recover">
              <input type="hidden" name="token" value="${token}">
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
              <button type="submit">Create New Admin Account</button>
            </form>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(password);

    // Insert new admin user
    db.run('INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [username, name, email, hashedPassword, 'admin'],
      function(err) {
        if (err) {
          console.error('Admin creation error:', err.message);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Admin Recovery</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error creating admin account. Please try again.</div>
                <div class="links">
                  <a href="/admin/recover?token=${token}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          // Generate a new recovery token for the new admin
          const newRecoveryToken = crypto.randomBytes(32).toString('hex');
          const newRecoveryTokenHash = crypto.createHash('sha256').update(newRecoveryToken).digest('hex');
          fs.writeFileSync(recoveryFilePath, newRecoveryTokenHash, 'utf8');

          const newRecoveryUrl = `https://localhost:${port}/admin/recover?token=${newRecoveryToken}`;

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Admin Recovery</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              <style>
                .recovery-modal {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.8);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  z-index: 1000;
                }
                .recovery-modal-content {
                  background: white;
                  padding: 30px;
                  border-radius: 12px;
                  max-width: 90%;
                  width: 500px;
                  text-align: center;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }
                .recovery-modal h2 {
                  color: #e74c3c;
                  margin-bottom: 15px;
                }
                .recovery-modal p {
                  color: #333;
                  margin-bottom: 20px;
                  line-height: 1.6;
                }
                .recovery-url-box {
                  background: #f8f9fa;
                  border: 2px solid #e74c3c;
                  border-radius: 8px;
                  padding: 15px;
                  margin: 20px 0;
                  word-break: break-all;
                  font-family: monospace;
                  font-size: 12px;
                  color: #333;
                  text-align: left;
                }
                .copy-btn {
                  background: #3498db;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 6px;
                  cursor: pointer;
                  margin-right: 10px;
                  font-size: 14px;
                }
                .copy-btn:hover {
                  background: #2980b9;
                }
                .proceed-btn {
                  background: #27ae60;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  text-decoration: none;
                  display: inline-block;
                }
                .proceed-btn:hover {
                  background: #219a52;
                }
                .warning-icon {
                  font-size: 48px;
                  margin-bottom: 15px;
                }
              </style>
            </head>
            <body>
              <div class="recovery-modal">
                <div class="recovery-modal-content">
                  <div class="warning-icon">⚠️</div>
                  <h2>Admin Account Created - NEW Recovery URL!</h2>
                  <p>Your new admin account has been created. A <strong>new recovery URL</strong> has been generated. The old recovery URL is no longer valid.</p>
                  <p><strong style="color: #e74c3c;">Save this new URL in a safe location NOW. You will NOT see it again!</strong></p>
                  <div class="recovery-url-box" id="recoveryUrl">${newRecoveryUrl}</div>
                  <div style="margin-top: 20px;">
                    <button class="copy-btn" onclick="copyUrl()">Copy URL</button>
                    <a href="/login" class="proceed-btn">I've Saved It - Proceed to Login</a>
                  </div>
                </div>
              </div>
              <script>
                function copyUrl() {
                  const urlText = document.getElementById('recoveryUrl').innerText;
                  navigator.clipboard.writeText(urlText).then(() => {
                    alert('Recovery URL copied to clipboard!');
                  }).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = urlText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Recovery URL copied to clipboard!');
                  });
                }
              </script>
            </body>
            </html>
          `);
        }
      });
  });

  // ============================================================
  // Login Page - GET /login
  // ============================================================
  router.get('/login', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${appConfig.appTitle} - Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${getLoginBackgroundStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>${appConfig.appTitle}</h1>
            ${appConfig.appSubtitle ? `<p class="subtitle">${appConfig.appSubtitle}</p>` : ''}
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

  // ============================================================
  // Login Handler - POST /login
  // ============================================================
  router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const renderLoginError = (message) => `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${appConfig.appTitle} - Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${getLoginBackgroundStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>${appConfig.appTitle}</h1>
            ${appConfig.appSubtitle ? `<p class="subtitle">${appConfig.appSubtitle}</p>` : ''}
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
        // Determine redirect based on role
        let redirectUrl = '/user';
        if (user.role === 'admin') redirectUrl = '/admin/dashboard';
        else if (user.role === 'judge') redirectUrl = '/judge';
        else if (user.role === 'registrar') redirectUrl = '/registrar';
        else if (user.role === 'vendor') redirectUrl = '/vendor';

        // If animated login is disabled, do a traditional redirect
        if (!appConfig.animatedLogin) {
          return res.redirect(redirectUrl);
        }

        // Compute dynamic background for animated transition
        const loginBg = appConfig.loginBackground || {};
        const useBgImage = loginBg.useImage && loginBg.imageUrl;
        const doorBackground = useBgImage
          ? `url('${loginBg.imageUrl}') no-repeat`
          : (loginBg.backgroundColor || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)');
        const welcomeBackground = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
        const animTintStyles = loginBg.useImage && loginBg.useTint ? `
              .door-left::after, .door-right::after {
                content: '';
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: ${loginBg.tintColor || '#1a1a2e'};
                opacity: ${loginBg.tintOpacity || 0.5};
                pointer-events: none;
              }
        ` : '';
        const cardOpacityVal = loginBg.cardOpacity ?? 0.98;

        // Send animated transition page
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${appConfig.appTitle} - Welcome</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${getLoginBackgroundStyles()}
            <style>
              body {
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
              }
              .door-left, .door-right {
                position: fixed;
                top: 0;
                width: 50%;
                height: 100%;
                z-index: 1;
                background: ${doorBackground};
                ${useBgImage ? 'background-size: 100vw 100vh;' : ''}
              }
              ${animTintStyles}
              .door-left {
                left: 0;
                transform-origin: left center;
                ${useBgImage ? 'background-position: left center;' : ''}
              }
              .door-right {
                right: 0;
                transform-origin: right center;
                ${useBgImage ? 'background-position: right center;' : ''}
              }
              .door-left.open {
                animation: doorOpenLeft 0.8s ease-in-out 0.4s forwards;
              }
              .door-right.open {
                animation: doorOpenRight 0.8s ease-in-out 0.4s forwards;
              }
              @keyframes doorOpenLeft {
                0% { transform: translateX(0); }
                100% { transform: translateX(-100%); }
              }
              @keyframes doorOpenRight {
                0% { transform: translateX(0); }
                100% { transform: translateX(100%); }
              }
              .container {
                position: relative;
                z-index: 2;
              }
              .container.fly-up {
                animation: flyUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
              }
              @keyframes flyUp {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(-120vh); opacity: 0; }
              }
              .welcome-reveal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 0;
                background: ${welcomeBackground};
              }
              .welcome-content {
                text-align: center;
                color: white;
                transform: scale(0.8);
                opacity: 0;
              }
              .welcome-reveal.show .welcome-content {
                animation: scaleIn 0.5s ease-out 1.0s forwards;
              }
              @keyframes scaleIn {
                0% { transform: scale(0.8); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
              .welcome-icon {
                font-size: 72px;
                margin-bottom: 16px;
              }
              .welcome-text {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 8px;
              }
              .welcome-sub {
                font-size: 16px;
                opacity: 0.7;
              }
            </style>
          </head>
          <body>
            <div class="door-left" id="doorLeft"></div>
            <div class="door-right" id="doorRight"></div>

            <div class="welcome-reveal" id="welcomeReveal">
              <div class="welcome-content">
                <div class="welcome-icon">🏎️</div>
                <div class="welcome-text">Welcome, ${user.name}!</div>
                <div class="welcome-sub">Loading your dashboard...</div>
              </div>
            </div>

            <div class="container" id="loginCard">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>${appConfig.appTitle}</h1>
                ${appConfig.appSubtitle ? `<p class="subtitle">${appConfig.appSubtitle}</p>` : ''}
              </div>
              <form>
                <div class="form-group">
                  <label>Username</label>
                  <input type="text" value="${username}" disabled>
                </div>
                <div class="form-group">
                  <label>Password</label>
                  <input type="password" value="********" disabled>
                </div>
                <button type="button" disabled style="opacity:0.7;">Signing in...</button>
              </form>
              <div class="links">
                <a href="/register" style="pointer-events:none;opacity:0.5;">Create an Account</a>
              </div>
            </div>

            <script>
              setTimeout(function() {
                document.getElementById('loginCard').classList.add('fly-up');
                setTimeout(function() {
                  document.getElementById('doorLeft').classList.add('open');
                  document.getElementById('doorRight').classList.add('open');
                  document.getElementById('welcomeReveal').classList.add('show');
                  setTimeout(function() {
                    window.location.href = '${redirectUrl}';
                  }, 2800);
                }, 300);
              }, 400);
            </script>
          </body>
          </html>
        `);
      } else {
        res.send(renderLoginError('Invalid username or password'));
      }
    });
  });

  // ============================================================
  // Registration Page - GET /register
  // ============================================================
  router.get('/register', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${appConfig.appTitle} - Register</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${getLoginBackgroundStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>${appConfig.appTitle}</h1>
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

  // ============================================================
  // Registration Handler - POST /register
  // ============================================================
  router.post('/register', (req, res) => {
    const { username, name, email, phone, password, confirm_password } = req.body;

    const renderRegisterError = (message, formData = {}) => `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${appConfig.appTitle} - Register</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${getLoginBackgroundStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>${appConfig.appTitle}</h1>
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
              <title>${appConfig.appTitle} - Registration Success</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${getLoginBackgroundStyles()}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>${appConfig.appTitle}</h1>
                </div>
                <div class="success-message">Account created successfully!</div>
                <p style="text-align: center; color: #666; margin-bottom: 20px;">Welcome to ${appConfig.appTitle}. You can now sign in.</p>
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

  // ============================================================
  // Dashboard Redirect - GET /dashboard
  // ============================================================
  router.get('/dashboard', requireAuth, (req, res) => {
    const user = req.session.user;
    if (user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else if (user.role === 'judge') {
      res.redirect('/judge');
    } else if (user.role === 'registrar') {
      res.redirect('/registrar');
    } else if (user.role === 'vendor') {
      res.redirect('/vendor');
    } else {
      res.redirect('/user');
    }
  });

  // ============================================================
  // Logout - GET /logout
  // ============================================================
  router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
  });

  return router;
};
