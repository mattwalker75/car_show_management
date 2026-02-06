// routes/judge.js - Judge dashboard, vehicle scoring, vehicle management, and user management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireJudge, hashPassword } = require('../middleware/auth');
  const { errorPage } = require('../views/layout');
  const { styles, adminStyles, getBodyTag, getAppBgStyles } = require('../views/htmlHelpers');
  const { getInitials, getAvatarContent, judgeNav, dashboardHeader, isChatEnabled, profileButton, getNav } = require('../views/components');
  const { renderVendorListPage, renderVendorDetailPage, renderProductDetailPage } = require('../helpers/vendorViews');

  const appBgStyles = () => getAppBgStyles(appConfig);
  const bodyTag = (req) => getBodyTag(req, appConfig);

  // ============================================================
  // Judge Dashboard
  // ============================================================
  router.get('/', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get count of active cars this judge has NOT yet scored
    db.get(`
      SELECT COUNT(DISTINCT c.car_id) as count
      FROM cars c
      WHERE c.is_active = 1
      AND c.car_id NOT IN (
        SELECT DISTINCT car_id FROM judge_scores WHERE judge_id = ?
      )
    `, [user.user_id], (err, carsToJudge) => {
      const carsToJudgeCount = carsToJudge ? carsToJudge.count : 0;

      // Get count of cars this judge has scored
      db.get(`
        SELECT COUNT(DISTINCT car_id) as count
        FROM judge_scores
        WHERE judge_id = ?
      `, [user.user_id], (err, scoresSubmitted) => {
        const scoresSubmittedCount = scoresSubmitted ? scoresSubmitted.count : 0;

        // Get total active cars
        db.get(`SELECT COUNT(*) as count FROM cars WHERE is_active = 1`, (err, totalCars) => {
          const totalCarsCount = totalCars ? totalCars.count : 0;

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Judge Dashboard - Car Show Manager</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
        ${appBgStyles()}
            </head>
            ${bodyTag(req)}
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Car Judge</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="welcome-card">
                  <h2>Welcome, Judge ${user.name}!</h2>
                  <p>Review and score car show entries.</p>
                </div>

                <div class="admin-nav">
                  <a href="/judge" class="active">Dashboard</a>
                  <a href="/judge/judge-vehicles">Judge Vehicles</a>
                  <a href="/judge/vehicles">Vehicles</a>
                  <a href="/judge/users">Users</a>
                  <a href="/judge/results">Results</a>
                  <a href="/judge/vendors">Vendors</a>
                  ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                  <a href="/user/vote">Vote Here!</a>
                </div>

                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-number">${carsToJudgeCount}</div>
                    <div class="stat-label">Cars to Judge</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">${scoresSubmittedCount}</div>
                    <div class="stat-label">Cars Scored</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">${totalCarsCount}</div>
                    <div class="stat-label">Total Active Cars</div>
                  </div>
                </div>

                ${appConfig.judgeVotingStatus === 'Lock' ? `
                  <div style="margin-top:20px;padding:15px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:8px;text-align:center;">
                    <strong>🔒 Voting is Locked</strong> - Results have been published. <a href="/judge/results">View Results</a>
                  </div>
                ` : appConfig.judgeVotingStatus === 'Close' ? `
                  <div style="margin-top:20px;padding:15px;background:var(--subnav-bg);border:1px solid #ccc;border-radius:8px;text-align:center;">
                    <strong>🚫 Voting is Closed</strong> - Contact administrator to Open Voting.
                  </div>
                ` : carsToJudgeCount > 0 ? `
                  <div style="margin-top:20px;text-align:center;">
                    <a href="/judge/judge-vehicles" style="display:inline-block;padding:15px 30px;background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Start Judging Vehicles</a>
                  </div>
                ` : ''}
              </div>
            </body>
            </html>
          `);
        });
      });
    });
  });

  // ============================================================
  // Users List
  // ============================================================
  router.get('/users', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get all non-admin users
    db.all('SELECT user_id as id, username, name, email, phone, role, is_active, image_url, created_at FROM users WHERE role != ? ORDER BY role, name', ['admin'], (err, users) => {
      if (err) {
        users = [];
      }

      const userCards = users.map(u => `
        <div class="user-card" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}" onclick="window.location.href='/judge/view-user/${u.id}'" style="cursor:pointer;">
          <div class="user-card-avatar">
            ${u.image_url ? `<img src="${u.image_url}" alt="${u.name}">` : getInitials(u.name)}
          </div>
          <div class="user-card-content">
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
            <div class="user-card-actions" onclick="event.stopPropagation()">
              <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
            </div>
          </div>
        </div>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Users - Judge Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users" class="active">Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
              <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Users & Judges</h3>
            <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and other judges. Admin accounts are not shown.</p>

            <div style="margin-bottom:16px;">
              <input type="text" id="userSearch" placeholder="Search by name, login ID, email, or phone..." oninput="filterUsers()" style="width:100%;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
            </div>
            <div id="noResults" style="display:none;text-align:center;color:var(--text-secondary);padding:20px;font-size:14px;">No users match your search.</div>

            <div class="user-cards">
              ${userCards}
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/judge">&larr; Back to Dashboard</a>
            </div>
          </div>
          <script>
            function filterUsers() {
              var query = document.getElementById('userSearch').value.toLowerCase().trim();
              var cards = document.querySelectorAll('.user-card');
              var visibleCount = 0;

              cards.forEach(function(card) {
                var match = !query || card.dataset.username.indexOf(query) !== -1 || card.dataset.name.indexOf(query) !== -1 || card.dataset.email.indexOf(query) !== -1 || card.dataset.phone.indexOf(query) !== -1;
                card.style.display = match ? '' : 'none';
                if (match) visibleCount++;
              });

              document.getElementById('noResults').style.display = (query && visibleCount === 0) ? '' : 'none';
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // ============================================================
  // View User - Detail Page
  // ============================================================
  router.get('/view-user/:id', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);
    const userId = req.params.id;

    // Only allow viewing non-admin users
    db.get('SELECT user_id as id, username, name, email, phone, role, is_active, image_url, created_at FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], (err, viewUser) => {
      if (err || !viewUser) {
        res.redirect('/judge/users');
        return;
      }

      // Get vehicles only for users with 'user' role
      const fetchVehicles = viewUser.role === 'user'
        ? (cb) => db.all(`SELECT c.car_id, c.year, c.make, c.model, c.image_url, c.is_active, c.voter_id,
              cl.class_name, v.vehicle_name
              FROM cars c
              LEFT JOIN classes cl ON c.class_id = cl.class_id
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              WHERE c.user_id = ?
              ORDER BY c.created_at DESC`, [userId], (err, rows) => cb(err ? [] : rows))
        : (cb) => cb([]);

      fetchVehicles((vehicles) => {
        const vehicleCards = vehicles.length > 0 ? vehicles.map(car => `
          <div class="vehicle-card" onclick="window.location.href='/judge/view-vehicle/${car.car_id}'" style="cursor:pointer;">
            <div class="vehicle-image">
              ${car.image_url
                ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
                : `<div class="vehicle-placeholder">🚗</div>`
              }
            </div>
            <div class="vehicle-info">
              <div class="vehicle-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</div>
              <div class="vehicle-class">
                ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                <span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending'}</span>
                ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);font-style:italic;text-align:center;padding:16px;">No vehicles registered.</p>';

        const vehiclesSection = viewUser.role === 'user' ? `
              <div class="vehicles-section">
                <h4>Vehicles (${vehicles.length})</h4>
                ${vehicleCards}
              </div>` : '';

        const vendorLink = viewUser.role === 'vendor' ? `
              <div class="vehicles-section">
                <h4>Vendor Store</h4>
                <a href="/judge/vendors/${viewUser.id}" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--container-bg);border:1px solid var(--card-border);border-radius:10px;text-decoration:none;color:var(--text-primary);font-weight:600;">
                  🏪 View Vendor Store
                </a>
              </div>` : '';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>View User - Judge Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
          ${appBgStyles()}
            <style>
              .user-profile-avatar {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 28px;
                color: white;
                background: var(--accent-primary);
                margin: 0 auto 16px;
              }
              .user-profile-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .detail-card {
                background: var(--modal-content-bg);
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 2px 10px var(--container-shadow);
                margin-bottom: 20px;
              }
              .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid var(--divider-color);
              }
              .detail-row:last-child {
                border-bottom: none;
              }
              .detail-label {
                font-weight: 600;
                color: var(--text-secondary);
              }
              .detail-value {
                color: var(--text-dark);
                text-align: right;
                max-width: 60%;
              }
              .vehicles-section {
                background: var(--card-bg);
                padding: 16px;
                border-radius: 12px;
                margin-bottom: 20px;
              }
              .vehicles-section h4 {
                color: var(--text-primary);
                margin-bottom: 12px;
              }
              .vehicle-card {
                background: var(--container-bg);
                border: 1px solid var(--card-border);
                border-radius: 10px;
                padding: 12px;
                margin-bottom: 8px;
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 12px;
              }
              .vehicle-image {
                width: 80px;
                height: 56px;
                border-radius: 8px;
                overflow: hidden;
                background: var(--card-border);
                flex-shrink: 0;
              }
              .vehicle-image img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
              .vehicle-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              }
              .vehicle-info { flex: 1; }
              .vehicle-title {
                font-size: 14px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 4px;
              }
              .vehicle-class {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
              }
              .type-badge {
                background: var(--btn-edit-bg);
                color: white;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
              }
              .class-badge {
                background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                color: white;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
              }
              .voter-badge {
                background: #9b59b6;
                color: white;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 600;
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Judge</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('judge')}
                    <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/judge">Dashboard</a>
                <a href="/judge/judge-vehicles">Judge Vehicles</a>
                <a href="/judge/vehicles">Vehicles</a>
                <a href="/judge/users" class="active">Users</a>
                <a href="/judge/results">Results</a>
                <a href="/judge/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
              </div>

              <div class="user-profile-avatar">
                ${viewUser.image_url ? `<img src="${viewUser.image_url}" alt="${viewUser.name}">` : getInitials(viewUser.name)}
              </div>

              <h3 class="section-title" style="text-align:center;">${viewUser.name}</h3>

              <div class="detail-card">
                <div class="detail-row">
                  <span class="detail-label">Username</span>
                  <span class="detail-value">@${viewUser.username}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email</span>
                  <span class="detail-value">${viewUser.email || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone</span>
                  <span class="detail-value">${viewUser.phone || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Role</span>
                  <span class="detail-value"><span class="role-badge ${viewUser.role}">${viewUser.role}</span></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status</span>
                  <span class="detail-value"><span class="status-badge ${viewUser.is_active ? 'active' : 'inactive'}">${viewUser.is_active ? 'Active' : 'Inactive'}</span></span>
                </div>
              </div>

              ${vehiclesSection}
              ${vendorLink}

              <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
                <a href="/judge/reset-password/${viewUser.id}" class="action-btn edit">Reset Password</a>
              </div>

              <div class="links" style="margin-top:20px;text-align:center;">
                <a href="/judge/users">&larr; Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // Reset Password - Show Form
  // ============================================================
  router.get('/reset-password/:id', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);
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
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
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
            <div class="links" style="margin-top:20px;">
              <a href="/judge/users">&larr; Back to Users</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ============================================================
  // Reset Password - Process Form
  // ============================================================
  router.post('/reset-password/:id', requireJudge, async (req, res) => {
    const userId = req.params.id;
    const { password, confirm_password } = req.body;

    // First verify the target user is not an admin
    db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], async (err, targetUser) => {
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
          ${bodyTag(req)}
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

      const hashedPassword = await hashPassword(password);
      db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role != ?', [hashedPassword, userId, 'admin'], function(err) {
        if (err) {
          console.error('Error resetting password:', err.message);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Reset Password - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            ${bodyTag(req)}
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error resetting password. Please try again.</div>
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
            ${bodyTag(req)}
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

  // ============================================================
  // Judge Vehicles - List vehicles for scoring
  // ============================================================
  router.get('/judge-vehicles', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Check if voting is not open
    if (appConfig.judgeVotingStatus !== 'Open') {
      const isLocked = appConfig.judgeVotingStatus === 'Lock';
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Judge Vehicles - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <div style="text-align:center;padding:40px;background:var(--card-bg);border-radius:8px;">
              <div style="font-size:48px;margin-bottom:20px;">${isLocked ? '🔒' : '🚫'}</div>
              <h3 style="color:var(--text-secondary);margin-bottom:10px;">${isLocked ? 'Voting is Locked' : 'Voting is not open yet'}</h3>
              <p style="color:var(--text-muted);">${isLocked ? 'Judging has been finalized by the administrator. <a href="/judge/results">View Results</a>' : 'Contact the administrator to open voting.'}</p>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Get all active cars that this judge has NOT yet scored
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
             u.name as owner_name, u.username as owner_username, u.email as owner_email,
             cl.class_name, v.vehicle_name
      FROM cars c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      WHERE c.is_active = 1
      AND c.car_id NOT IN (SELECT DISTINCT car_id FROM judge_scores WHERE judge_id = ?)
      ORDER BY cl.class_name, c.make, c.model
    `, [user.user_id], (err, carsToJudge) => {
      if (err) carsToJudge = [];

      // Get cars this judge has already scored
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id, cl.class_name,
               SUM(js.score) as total_score
        FROM cars c
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        JOIN judge_scores js ON c.car_id = js.car_id AND js.judge_id = ?
        WHERE c.is_active = 1
        GROUP BY c.car_id
        ORDER BY cl.class_name, c.make, c.model
      `, [user.user_id], (err, carsJudged) => {
        if (err) carsJudged = [];

        // Build sorted voter ID list for dropdown
        const judgeVoterIds = carsToJudge.map(c => c.voter_id).filter(Boolean).sort((a, b) => a - b);

        const toJudgeCards = carsToJudge.map(car => `
          <div class="vehicle-card to-judge-card" data-year="${(car.year || '').toString().toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-username="${(car.owner_username || '').toLowerCase()}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-voterid="${car.voter_id || ''}">
            <div class="vehicle-image">
              ${car.image_url
                ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
                : `<div class="vehicle-placeholder">🚗</div>`
              }
            </div>
            <div class="vehicle-info">
              <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
              <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
              <div class="vehicle-class">
                ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              </div>
            </div>
            <div class="vehicle-actions">
              <a href="/judge/score-vehicle/${car.car_id}" class="action-btn" style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);">Score Vehicle</a>
            </div>
          </div>
        `).join('');

        const judgedCards = carsJudged.map(car => `
          <div class="vehicle-card" style="border-color:var(--success-color);">
            <div class="vehicle-info" style="flex:1;">
              <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
              <div class="vehicle-class">
                ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="background:var(--success-color);color:white;padding:6px 14px;border-radius:20px;font-weight:600;">${car.total_score} pts</span>
              <span style="color:var(--success-color);font-weight:600;">✓ Scored</span>
            </div>
          </div>
        `).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Judge Vehicles - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
            <style>
              .vehicle-card {
                background: var(--card-bg);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                border: 1px solid var(--card-border);
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 12px;
              }
              .vehicle-image {
                width: 100px;
                height: 70px;
                border-radius: 8px;
                overflow: hidden;
                background: var(--card-border);
                flex-shrink: 0;
              }
              .vehicle-image img {
                width: 100%;
                height: 100%;
                object-fit: contain;
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
              .vehicle-info { flex: 1; }
              .vehicle-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 4px;
              }
              .vehicle-meta {
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 8px;
              }
              .vehicle-class {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
              }
              .type-badge {
                background: var(--btn-edit-bg);
                color: white;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
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
                background: #9b59b6;
                color: white;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
              }
              .vehicle-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
              }
              .product-card.sold-out { opacity: 0.7; }
              .product-card.sold-out h5 { color: var(--error-color); }
              @media (min-width: 768px) {
                .vehicle-image {
                  width: 150px;
                  height: 100px;
                }
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Judge</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/judge">Dashboard</a>
                <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
                <a href="/judge/vehicles">Vehicles</a>
                <a href="/judge/users">Users</a>
                <a href="/judge/results">Results</a>
                <a href="/judge/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Vehicles Ready to Judge (<span id="toJudgeCount">${carsToJudge.length}</span>)</h3>

              <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
                <input type="text" id="vehicleSearch" placeholder="Search by year, make, model, owner, or email..." oninput="filterVehicles()" style="flex:1;min-width:200px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
                <select id="voterIdFilter" onchange="filterVehicles()" style="min-width:140px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;">
                  <option value="">All Voter IDs</option>
                  ${judgeVoterIds.map(id => `<option value="${id}">#${id}</option>`).join('')}
                </select>
              </div>
              <div id="noResults" style="display:none;text-align:center;color:var(--text-secondary);padding:20px;font-size:14px;">No vehicles match your search.</div>

              ${carsToJudge.length > 0 ? toJudgeCards : '<p style="color: var(--success-color); text-align: center; padding: 20px; background: var(--status-active-bg); border-radius: 8px;">🎉 You have scored all active vehicles!</p>'}

              ${carsJudged.length > 0 ? `
                <h3 class="section-title" style="margin-top:30px;">Already Scored (${carsJudged.length})</h3>
                ${judgedCards}
              ` : ''}
            </div>
            <script>
              function filterVehicles() {
                var query = document.getElementById('vehicleSearch').value.toLowerCase().trim();
                var voterId = document.getElementById('voterIdFilter').value;
                var cards = document.querySelectorAll('.to-judge-card');
                var visibleCount = 0;

                cards.forEach(function(card) {
                  var year = card.dataset.year || '';
                  var make = card.dataset.make || '';
                  var model = card.dataset.model || '';
                  var username = card.dataset.username || '';
                  var name = card.dataset.name || '';
                  var email = card.dataset.email || '';
                  var voterid = card.dataset.voterid || '';

                  var matchesSearch = !query || year.indexOf(query) !== -1 || make.indexOf(query) !== -1 || model.indexOf(query) !== -1 || username.indexOf(query) !== -1 || name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
                  var matchesVoterId = !voterId || voterid === voterId;

                  var match = matchesSearch && matchesVoterId;
                  card.style.display = match ? '' : 'none';
                  if (match) visibleCount++;
                });

                document.getElementById('toJudgeCount').textContent = visibleCount;
                document.getElementById('noResults').style.display = ((query || voterId) && visibleCount === 0) ? '' : 'none';
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // Score Vehicle - Scoring form with bubble interface
  // ============================================================
  router.get('/score-vehicle/:carId', requireJudge, (req, res) => {
    const user = req.session.user;
    const carId = req.params.carId;
    const avatarContent = getAvatarContent(user);

    // Check if voting is not open
    if (appConfig.judgeVotingStatus !== 'Open') {
      res.redirect('/judge/judge-vehicles');
      return;
    }

    // Get car details
    db.get(`
      SELECT c.*, u.name as owner_name, cl.class_name, v.vehicle_id, v.vehicle_name
      FROM cars c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      WHERE c.car_id = ? AND c.is_active = 1
    `, [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/judge/judge-vehicles');
        return;
      }

      // Check if judge has already scored this vehicle
      db.get(`SELECT COUNT(*) as count FROM judge_scores WHERE judge_id = ? AND car_id = ?`, [user.user_id, carId], (err, scored) => {
        if (scored && scored.count > 0) {
          res.redirect('/judge/judge-vehicles');
          return;
        }

        // Get judging categories and questions for this vehicle type
        db.all(`
          SELECT jc.judge_catagory_id, jc.catagory_name, jc.display_order as cat_order
          FROM judge_catagories jc
          WHERE jc.vehicle_id = ? AND jc.is_active = 1
          ORDER BY jc.display_order, jc.catagory_name
        `, [car.vehicle_id], (err, categories) => {
          if (err) categories = [];

          db.all(`
            SELECT jq.judge_question_id, jq.judge_catagory_id, jq.question, jq.min_score, jq.max_score, jq.display_order
            FROM judge_questions jq
            WHERE jq.vehicle_id = ? AND jq.is_active = 1
            ORDER BY jq.display_order, jq.question
          `, [car.vehicle_id], (err, questions) => {
            if (err) questions = [];

            // Group questions by category
            const questionsByCategory = {};
            questions.forEach(q => {
              if (!questionsByCategory[q.judge_catagory_id]) {
                questionsByCategory[q.judge_catagory_id] = [];
              }
              questionsByCategory[q.judge_catagory_id].push(q);
            });

            // Build the scoring form with bubble selectors
            const categoryForms = categories.map(cat => {
              const catQuestions = questionsByCategory[cat.judge_catagory_id] || [];
              const questionInputs = catQuestions.map(q => {
                let bubbles = '';
                for (let i = q.min_score; i <= q.max_score; i++) {
                  bubbles += `<div class="score-bubble" data-value="${i}" onclick="selectScore(this, 'score_${q.judge_question_id}')">${i}</div>`;
                }
                return `
                  <div class="score-question">
                    <div class="question-text">${q.question} <span class="score-range">(${q.min_score}-${q.max_score})</span></div>
                    <div class="bubble-row">
                      ${bubbles}
                    </div>
                    <input type="hidden" name="score_${q.judge_question_id}" id="score_${q.judge_question_id}" required>
                  </div>
                `;
              }).join('');

              return `
                <div class="category-section">
                  <h4 class="category-title">${cat.catagory_name}</h4>
                  ${questionInputs || '<p style="color:var(--text-muted);">No questions in this category</p>'}
                </div>
              `;
            }).join('');

            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Score Vehicle - Car Show Manager</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
                ${adminStyles}
        ${appBgStyles()}
                <style>
                  .car-header {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 20px;
                    align-items: center;
                  }
                  .car-header-image {
                    width: 120px;
                    height: 80px;
                    border-radius: 8px;
                    overflow: hidden;
                    flex-shrink: 0;
                  }
                  .car-header-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                  }
                  .car-header-info h2 {
                    margin: 0 0 8px 0;
                    font-size: 20px;
                  }
                  .car-header-info p {
                    margin: 0;
                    opacity: 0.8;
                    font-size: 14px;
                  }
                  .category-section {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 15px;
                    border: 1px solid var(--card-border);
                  }
                  .category-title {
                    margin: 0 0 15px 0;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--btn-edit-bg);
                    color: var(--heading-alt);
                  }
                  .score-question {
                    padding: 12px 0;
                    border-bottom: 1px solid var(--card-border);
                  }
                  .score-question:last-child {
                    border-bottom: none;
                  }
                  .question-text {
                    font-size: 14px;
                    color: var(--text-dark);
                    margin-bottom: 8px;
                  }
                  .score-range {
                    font-size: 12px;
                    color: var(--text-muted);
                    font-weight: 400;
                  }
                  .bubble-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                  }
                  .score-bubble {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid var(--card-border);
                    background: var(--modal-content-bg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-dark);
                    cursor: pointer;
                    transition: all 0.15s;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                  }
                  .score-bubble:active {
                    transform: scale(0.95);
                  }
                  .score-bubble.selected {
                    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                    color: white;
                    border-color: var(--info-highlight-text);
                    box-shadow: 0 2px 8px rgba(52, 152, 219, 0.4);
                  }
                  .submit-section {
                    background: var(--warning-bg);
                    border: 2px solid var(--warning-border);
                    border-radius: 12px;
                    padding: 20px;
                    margin-top: 20px;
                    text-align: center;
                  }
                  .submit-warning {
                    color: var(--warning-text);
                    margin-bottom: 15px;
                    font-size: 14px;
                  }
                  .submit-btn {
                    background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: 600;
                    cursor: pointer;
                  }
                  .submit-btn:hover {
                    opacity: 0.9;
                  }
                  @media (max-width: 600px) {
                    .score-bubble {
                      width: 36px;
                      height: 36px;
                      font-size: 13px;
                    }
                  }
                </style>
              </head>
              ${bodyTag(req)}
                <div class="container dashboard-container">
                  <div class="dashboard-header">
                    <h1>🏎️ Car Judge</h1>
                    <div class="user-info">
                      <div class="user-avatar">${avatarContent}</div>
                      ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                    </div>
                  </div>

                  <div class="admin-nav">
                    <a href="/judge">Dashboard</a>
                    <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
                    <a href="/judge/vehicles">Vehicles</a>
                    <a href="/judge/users">Users</a>
                    <a href="/judge/results">Results</a>
                    <a href="/judge/vendors">Vendors</a>
                    ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                    <a href="/user/vote">Vote Here!</a>
                  </div>

                  <div class="car-header">
                    ${car.image_url ? `
                      <div class="car-header-image">
                        <img src="${car.image_url}" alt="${car.make} ${car.model}">
                      </div>
                    ` : ''}
                    <div class="car-header-info">
                      <h2>${car.year || ''} ${car.make} ${car.model}</h2>
                      <p>Owner: ${car.owner_name || 'Unknown'} | Voter ID: #${car.voter_id || 'N/A'}</p>
                      <p>Class: ${car.class_name || 'Unassigned'} | Type: ${car.vehicle_name || 'Unknown'}</p>
                    </div>
                  </div>

                  <form method="POST" action="/judge/submit-scores/${carId}" onsubmit="return confirmSubmit()">
                    <h3 class="section-title">Scoring Sheet</h3>

                    ${categoryForms || '<p style="color:var(--error-color);padding:20px;background:var(--card-bg);border-radius:8px;">No judging categories configured for this vehicle type. Please contact the administrator.</p>'}

                    ${categories.length > 0 ? `
                      <div class="submit-section">
                        <p class="submit-warning">⚠️ <strong>Warning:</strong> Once you submit your scores, you cannot change them. Please review all scores carefully before submitting.</p>
                        <button type="submit" class="submit-btn">Submit Scores</button>
                      </div>
                    ` : ''}
                  </form>

                  <div style="margin-top:20px;">
                    <a href="/judge/judge-vehicles" style="color:var(--text-secondary);">← Back to Vehicles List</a>
                  </div>
                </div>

                <script>
                  function selectScore(bubble, inputName) {
                    // Deselect siblings
                    bubble.parentNode.querySelectorAll('.score-bubble').forEach(b => b.classList.remove('selected'));
                    // Select this one
                    bubble.classList.add('selected');
                    // Set hidden input value
                    document.getElementById(inputName).value = bubble.dataset.value;
                  }

                  function confirmSubmit() {
                    // Check all hidden score inputs have values
                    const hiddenInputs = document.querySelectorAll('input[type="hidden"][name^="score_"]');
                    for (const input of hiddenInputs) {
                      if (!input.value) {
                        alert('Please select a score for every question before submitting.');
                        return false;
                      }
                    }
                    return confirm('Are you sure you want to submit these scores?\\n\\nOnce submitted, you CANNOT change your scores for this vehicle.');
                  }
                </script>
              </body>
              </html>
            `);
          });
        });
      });
    });
  });

  // ============================================================
  // Submit Scores - Save scores for a vehicle
  // ============================================================
  router.post('/submit-scores/:carId', requireJudge, (req, res) => {
    const user = req.session.user;
    const carId = req.params.carId;

    // Check if voting is not open
    if (appConfig.judgeVotingStatus !== 'Open') {
      res.redirect('/judge/judge-vehicles');
      return;
    }

    // Check if already scored
    db.get(`SELECT COUNT(*) as count FROM judge_scores WHERE judge_id = ? AND car_id = ?`, [user.user_id, carId], (err, scored) => {
      if (scored && scored.count > 0) {
        res.redirect('/judge/judge-vehicles');
        return;
      }

      // Extract scores from form
      const scores = [];
      for (const key in req.body) {
        if (key.startsWith('score_')) {
          const questionId = key.replace('score_', '');
          const score = parseInt(req.body[key]);
          if (!isNaN(score)) {
            scores.push({ questionId, score });
          }
        }
      }

      if (scores.length === 0) {
        res.redirect(`/judge/score-vehicle/${carId}`);
        return;
      }

      // Insert all scores
      const placeholders = scores.map(() => '(?, ?, ?, ?)').join(', ');
      const values = [];
      scores.forEach(s => {
        values.push(user.user_id, carId, s.questionId, s.score);
      });

      db.run(`INSERT INTO judge_scores (judge_id, car_id, question_id, score) VALUES ${placeholders}`, values, (err) => {
        if (err) {
          console.error('Error saving scores:', err);
        }
        res.redirect('/judge/judge-vehicles');
      });
    });
  });

  // ============================================================
  // View Judge Results
  // ============================================================
  router.get('/results', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Check if results are published
    const judgeResultsPublished = appConfig.judgeVotingStatus === 'Lock';
    const specialtyResultsPublished = appConfig.specialtyVotingStatus === 'Lock';

    if (!judgeResultsPublished && !specialtyResultsPublished) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Results - Judge</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Judge Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">Users</a>
              <a href="/judge/results" class="active">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Results</h3>
            <div style="text-align:center;padding:40px;background:var(--card-bg);border-radius:8px;">
              <div style="font-size:48px;margin-bottom:20px;">🔒</div>
              <h3 style="color:var(--text-secondary);margin-bottom:10px;">Results Not Yet Published</h3>
              <p style="color:var(--text-muted);">Results will be available here once voting has been locked by the administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Get published judge results
    db.all(`
      SELECT pr.*, c.year, c.make, c.model, c.voter_id, cl.class_name
      FROM published_results pr
      JOIN cars c ON pr.car_id = c.car_id
      LEFT JOIN classes cl ON pr.class_id = cl.class_id
      WHERE pr.result_type = 'judge'
      ORDER BY pr.class_id, pr.place
    `, (err, judgeResults) => {
      if (err) judgeResults = [];

      // Get published specialty vote results
      db.all(`
        SELECT pr.*, c.year, c.make, c.model, c.voter_id, sv.vote_name
        FROM published_results pr
        JOIN cars c ON pr.car_id = c.car_id
        LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
        WHERE pr.result_type = 'specialty'
        ORDER BY sv.vote_name
      `, (err, specialtyResults) => {
        if (err) specialtyResults = [];

        // Group judge results by class
        const judgeResultsByClass = {};
        judgeResults.forEach(r => {
          if (!judgeResultsByClass[r.class_name]) {
            judgeResultsByClass[r.class_name] = [];
          }
          judgeResultsByClass[r.class_name].push(r);
        });

        const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

        // Build judge results HTML
        let judgeResultsHtml = '';
        if (judgeResultsPublished && Object.keys(judgeResultsByClass).length > 0) {
          judgeResultsHtml = `
            <h3 class="section-title">Judge Results - Winners by Class</h3>
            ${Object.keys(judgeResultsByClass).map(className => {
              const classResults = judgeResultsByClass[className];
              const resultsList = classResults.map(r => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${r.place === 1 ? 'var(--gold-bg)' : 'var(--card-bg)'};border-radius:6px;margin-bottom:8px;border:${r.place === 1 ? '2px solid var(--gold-border)' : '1px solid var(--card-border)'};">
                  <span><strong>${placeLabels[r.place - 1] || r.place}</strong> - ${r.year || ''} ${r.make} ${r.model} (ID: ${r.voter_id || 'N/A'})</span>
                  <span style="background:var(--success-color);color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${r.total_score || 0} pts</span>
                </div>
              `).join('');
              return `
                <div style="background:var(--modal-bg);border:1px solid var(--card-border);border-radius:8px;padding:20px;margin-bottom:20px;">
                  <h4 style="margin:0 0 15px 0;color:var(--heading-alt);border-bottom:2px solid var(--btn-edit-bg);padding-bottom:10px;">${className}</h4>
                  ${resultsList}
                </div>
              `;
            }).join('')}
          `;
        } else if (judgeResultsPublished) {
          judgeResultsHtml = `
            <h3 class="section-title">Judge Results</h3>
            <p style="color:var(--text-muted);">No judge results have been published yet.</p>
          `;
        }

        // Build specialty results HTML
        let specialtyResultsHtml = '';
        if (specialtyResultsPublished && specialtyResults.length > 0) {
          specialtyResultsHtml = `
            <h3 class="section-title" style="margin-top:30px;">Specialty Vote Winners</h3>
            ${specialtyResults.map(r => `
              <div style="background:var(--modal-bg);border:1px solid var(--card-border);border-radius:8px;padding:20px;margin-bottom:20px;">
                <h4 style="margin:0 0 15px 0;color:var(--heading-alt);border-bottom:2px solid var(--badge-purple-bg);padding-bottom:10px;">${r.vote_name}</h4>
                <div style="background:var(--gold-bg);border:2px solid var(--gold-border);border-radius:8px;padding:15px;text-align:center;">
                  <div style="font-size:36px;margin-bottom:10px;">🏆</div>
                  <div style="font-size:18px;font-weight:bold;color:var(--heading-alt);">${r.year || ''} ${r.make} ${r.model}</div>
                  <div style="color:var(--text-secondary);margin-top:5px;">Voter ID: ${r.voter_id || 'N/A'}</div>
                  <div style="margin-top:10px;background:var(--success-color);color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-weight:600;">${r.total_score || 0} votes</div>
                </div>
              </div>
            `).join('')}
          `;
        } else if (specialtyResultsPublished) {
          specialtyResultsHtml = `
            <h3 class="section-title" style="margin-top:30px;">Specialty Vote Results</h3>
            <p style="color:var(--text-muted);">No specialty vote results have been published yet.</p>
          `;
        }

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Results - Judge</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Judge Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/judge">Dashboard</a>
                <a href="/judge/judge-vehicles">Judge Vehicles</a>
                <a href="/judge/vehicles">Vehicles</a>
                <a href="/judge/users">Users</a>
                <a href="/judge/results" class="active">Results</a>
                <a href="/judge/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
              </div>

              ${judgeResultsHtml}
              ${specialtyResultsHtml}
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // View All Vehicles
  // ============================================================
  router.get('/vehicles', requireJudge, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get all active vehicles with owner info and class names
    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
            u.name as owner_name, u.username as owner_username, u.email as owner_email,
            cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.is_active = 1
            ORDER BY cl.class_name, c.make, c.model`, (err, activeCars) => {
      if (err) activeCars = [];

      // Get all inactive vehicles
      db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
              u.name as owner_name, u.username as owner_username, u.email as owner_email,
              cl.class_name, v.vehicle_name
              FROM cars c
              LEFT JOIN users u ON c.user_id = u.user_id
              LEFT JOIN classes cl ON c.class_id = cl.class_id
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              WHERE c.is_active = 0
              ORDER BY c.make, c.model`, (err, inactiveCars) => {
        if (err) inactiveCars = [];

        // Build sorted voter ID list for dropdown
        const allVehicleCars = [...activeCars, ...inactiveCars];
        const voterIds = allVehicleCars.map(c => c.voter_id).filter(Boolean).sort((a, b) => a - b);

        const vehicleCards = activeCars.map(car => `
          <div class="vehicle-card" data-year="${(car.year || '').toString().toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-username="${(car.owner_username || '').toLowerCase()}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-voterid="${car.voter_id || ''}" data-status="active" onclick="window.location.href='/judge/view-vehicle/${car.car_id}'" style="cursor:pointer;">
            <div class="vehicle-image">
              ${car.image_url
                ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
                : `<div class="vehicle-placeholder">🚗</div>`
              }
            </div>
            <div class="vehicle-info">
              <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
              <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
              <div class="vehicle-class">
                ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              </div>
              ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
            </div>
            <div class="vehicle-actions" onclick="event.stopPropagation()">
              <a href="/judge/edit-vehicle/${car.car_id}" class="action-btn edit">Change Class</a>
            </div>
          </div>
        `).join('');

        const inactiveVehicleCards = inactiveCars.map(car => `
          <div class="vehicle-card" data-year="${(car.year || '').toString().toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-username="${(car.owner_username || '').toLowerCase()}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-voterid="${car.voter_id || ''}" data-status="pending" style="opacity: 0.7; border-color: var(--warning-border); cursor:pointer;" onclick="window.location.href='/judge/view-vehicle/${car.car_id}'">
            <div class="vehicle-image">
              ${car.image_url
                ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
                : `<div class="vehicle-placeholder">🚗</div>`
              }
            </div>
            <div class="vehicle-info">
              <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
              <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
              <div class="vehicle-class">
                ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              </div>
              ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
            </div>
            <div class="vehicle-actions">
              <span style="color:var(--warning-text);font-size:12px;font-weight:600;">⏳ Awaiting Activation</span>
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
        ${appBgStyles()}
          <style>
            .vehicle-card {
              background: var(--card-bg);
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 12px;
              border: 1px solid var(--card-border);
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 12px;
            }
            .vehicle-image {
              width: 100px;
              height: 70px;
              border-radius: 8px;
              overflow: hidden;
              background: var(--card-border);
              flex-shrink: 0;
            }
            .vehicle-image img {
              width: 100%;
              height: 100%;
              object-fit: contain;
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
              color: var(--text-primary);
              margin-bottom: 4px;
            }
            .vehicle-meta {
              font-size: 12px;
              color: var(--text-muted);
              margin-bottom: 8px;
            }
            .vehicle-class {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 8px;
            }
            .type-badge {
              background: var(--btn-edit-bg);
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
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
              background: #9b59b6;
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .vehicle-description {
              font-size: 13px;
              color: var(--text-secondary);
              line-height: 1.4;
            }
            .vehicle-actions {
              display: flex;
              gap: 8px;
              flex-shrink: 0;
            }
            @media (min-width: 768px) {
              .vehicle-image {
                width: 150px;
                height: 100px;
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles" class="active">Vehicles</a>
              <a href="/judge/users">Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">All Vehicles (${activeCars.length + inactiveCars.length})</h3>

            <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="vehicleSearch" placeholder="Search by year, make, model, owner, or email..." oninput="filterVehicles()" style="flex:1;min-width:200px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
              <select id="statusFilter" onchange="filterVehicles()" style="min-width:140px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;">
                <option value="">All Statuses</option>
                <option value="pending">Pending Payment</option>
                <option value="active">Active</option>
              </select>
              <select id="voterIdFilter" onchange="filterVehicles()" style="min-width:140px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;">
                <option value="">All Voter IDs</option>
                ${voterIds.map(id => `<option value="${id}">#${id}</option>`).join('')}
              </select>
            </div>
            <div id="noResults" style="display:none;text-align:center;color:var(--text-secondary);padding:20px;font-size:14px;">No vehicles match your search.</div>

            <div id="activeSection">
              <h3 class="section-title">Active Vehicles (<span id="activeCount">${activeCars.length}</span>)</h3>
              <div id="activeVehicles">
                ${activeCars.length > 0 ? vehicleCards : '<p class="no-vehicles-msg" style="color: var(--text-secondary); text-align: center; padding: 20px;">No active vehicles to judge.</p>'}
              </div>
            </div>

            <div id="inactiveSection">
              <h3 class="section-title" style="margin-top:30px;">Inactive Vehicles - Awaiting Registration (<span id="inactiveCount">${inactiveCars.length}</span>)</h3>
              <p style="color:var(--warning-text);font-size:13px;margin-bottom:15px;">These vehicles are waiting to be activated by the registrar. You cannot judge them until they are activated.</p>
              <div id="inactiveVehicles">
                ${inactiveCars.length > 0 ? inactiveVehicleCards : '<p class="no-vehicles-msg" style="color: var(--text-secondary); text-align: center; padding: 20px;">No inactive vehicles.</p>'}
              </div>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/judge">&larr; Back to Dashboard</a>
            </div>
          </div>
          <script>
            function filterVehicles() {
              var query = document.getElementById('vehicleSearch').value.toLowerCase().trim();
              var status = document.getElementById('statusFilter').value;
              var voterId = document.getElementById('voterIdFilter').value;
              var cards = document.querySelectorAll('.vehicle-card');
              var visibleCount = 0;
              var activeVisible = 0;
              var inactiveVisible = 0;

              cards.forEach(function(card) {
                var year = card.dataset.year || '';
                var make = card.dataset.make || '';
                var model = card.dataset.model || '';
                var username = card.dataset.username || '';
                var name = card.dataset.name || '';
                var email = card.dataset.email || '';
                var voterid = card.dataset.voterid || '';
                var cardStatus = card.dataset.status || '';

                var matchesSearch = !query || year.indexOf(query) !== -1 || make.indexOf(query) !== -1 || model.indexOf(query) !== -1 || username.indexOf(query) !== -1 || name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
                var matchesStatus = !status || cardStatus === status;
                var matchesVoterId = !voterId || voterid === voterId;

                if (matchesSearch && matchesStatus && matchesVoterId) {
                  card.style.display = '';
                  visibleCount++;
                  if (cardStatus === 'active') activeVisible++;
                  else inactiveVisible++;
                } else {
                  card.style.display = 'none';
                }
              });

              document.getElementById('activeCount').textContent = activeVisible;
              document.getElementById('inactiveCount').textContent = inactiveVisible;
              document.getElementById('activeSection').style.display = (status === 'pending') ? 'none' : '';
              document.getElementById('inactiveSection').style.display = (status === 'active') ? 'none' : '';
              document.getElementById('noResults').style.display = (visibleCount === 0 && cards.length > 0) ? '' : 'none';
            }
          </script>
        </body>
        </html>
      `);
      });
    });
  });

  // ============================================================
  // View Vehicle Detail (read-only)
  // ============================================================
  router.get('/view-vehicle/:id', requireJudge, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const avatarContent = getAvatarContent(user);

    db.get(`SELECT c.*, u.name as owner_name, u.username as owner_username, u.email as owner_email, u.phone as owner_phone,
            cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.car_id = ?`, [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/judge/vehicles');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>View Vehicle - Judge Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
          <style>
            .vehicle-detail-image {
              width: 100%;
              max-width: 400px;
              height: 250px;
              border-radius: 12px;
              overflow: hidden;
              background: var(--card-border);
              margin: 0 auto 20px;
              cursor: pointer;
            }
            .vehicle-detail-image img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .vehicle-detail-placeholder {
              width: 100%;
              max-width: 400px;
              height: 250px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 64px;
              margin: 0 auto 20px;
            }
            .detail-card {
              background: var(--modal-content-bg);
              border-radius: 12px;
              padding: 20px;
              box-shadow: 0 2px 10px var(--container-shadow);
              margin-bottom: 20px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid var(--divider-color);
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: var(--text-secondary);
            }
            .detail-value {
              color: var(--text-dark);
              text-align: right;
              max-width: 60%;
            }
            .description-section {
              background: var(--card-bg);
              padding: 16px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .description-section h4 {
              color: var(--text-primary);
              margin-bottom: 8px;
            }
            .description-section p {
              color: var(--text-secondary);
              font-size: 14px;
              line-height: 1.5;
            }
            .owner-details {
              background: var(--info-highlight-bg);
              padding: 16px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .owner-details h4 {
              color: var(--info-highlight-text);
              margin-bottom: 10px;
            }
            .owner-details p {
              margin: 4px 0;
              color: var(--text-dark);
            }
            .image-modal {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.95);
              z-index: 10000;
              justify-content: center;
              align-items: center;
              padding: 20px;
            }
            .image-modal.active {
              display: flex;
            }
            .image-modal img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              border-radius: 8px;
            }
            .image-modal-close {
              position: absolute;
              top: 20px;
              right: 20px;
              background: rgba(255, 255, 255, 0.2);
              color: white;
              border: none;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              font-size: 24px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            @media (min-width: 768px) {
              .vehicle-detail-image {
                height: 350px;
              }
              .vehicle-detail-placeholder {
                height: 350px;
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Judge Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('judge')}
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">${car.year || ''} ${car.make} ${car.model}</h3>

            ${car.image_url
              ? `<div class="vehicle-detail-image" onclick="openImageModal('${car.image_url}', '${car.year || ''} ${car.make} ${car.model}')"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
              : `<div class="vehicle-detail-placeholder">🚗</div>`
            }

            <div class="detail-card">
              <div class="detail-row">
                <span class="detail-label">Year</span>
                <span class="detail-value">${car.year || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Make</span>
                <span class="detail-value">${car.make}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Model</span>
                <span class="detail-value">${car.model}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <span class="detail-value">${car.vehicle_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Class</span>
                <span class="detail-value">${car.class_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value"><span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending'}</span></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Registration Number</span>
                <span class="detail-value">${car.voter_id ? '#' + car.voter_id : 'Not assigned'}</span>
              </div>
            </div>

            ${car.description ? `
              <div class="description-section">
                <h4>Description</h4>
                <p>${car.description}</p>
              </div>
            ` : ''}

            <a href="/judge/view-user/${car.user_id}" style="text-decoration:none;color:inherit;display:block;">
              <div class="owner-details" style="cursor:pointer;transition:border-color 0.2s;">
                <h4>Owner Information</h4>
                <p><strong>Name:</strong> ${car.owner_name || 'Unknown'}</p>
                <p><strong>Username:</strong> @${car.owner_username || 'N/A'}</p>
                <p><strong>Email:</strong> ${car.owner_email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${car.owner_phone || 'N/A'}</p>
              </div>
            </a>

            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
              <a href="/judge/edit-vehicle/${car.car_id}" class="action-btn edit">Change Class</a>
            </div>
            <div class="links" style="margin-top:20px;text-align:center;">
              <a href="/judge/vehicles">&larr; Back to Vehicles</a>
            </div>
          </div>

          <div class="image-modal" id="imageModal" onclick="closeImageModal()">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <img id="modalImage" src="" alt="">
          </div>

          <script>
            function openImageModal(src, alt) {
              var modal = document.getElementById('imageModal');
              var img = document.getElementById('modalImage');
              img.src = src;
              img.alt = alt;
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }
            function closeImageModal() {
              document.getElementById('imageModal').classList.remove('active');
              document.body.style.overflow = '';
            }
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') closeImageModal();
            });
          </script>
        </body>
        </html>
      `);
    });
  });

  // ============================================================
  // Edit Vehicle Class - Show Form
  // ============================================================
  router.get('/edit-vehicle/:id', requireJudge, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const avatarContent = getAvatarContent(user);

    db.get(`SELECT c.*, u.name as owner_name, cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.car_id = ? AND c.is_active = 1`, [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/judge/vehicles');
        return;
      }

      // Get classes for the current vehicle type (judges can only change class within same vehicle type)
      db.all(`SELECT class_id, class_name FROM classes WHERE vehicle_id = ? AND is_active = 1 ORDER BY class_name`,
        [car.vehicle_id], (err, classes) => {
        if (err) classes = [];

        const classOptionsHtml = classes.map(c =>
          `<option value="${c.class_id}" ${car.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Vehicle Class - Judge Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
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
                background: var(--card-border);
              }
              .vehicle-preview-image img {
                width: 100%;
                height: 100%;
                object-fit: contain;
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
                color: var(--text-primary);
              }
              .vehicle-preview-info p {
                color: var(--text-secondary);
                margin-bottom: 8px;
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Judge</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('judge')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/judge">Dashboard</a>
                <a href="/judge/judge-vehicles">Judge Vehicles</a>
                <a href="/judge/vehicles">Vehicles</a>
                <a href="/judge/users">Users</a>
                <a href="/judge/results">Results</a>
                <a href="/judge/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
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
                  <p><strong>Vehicle Type:</strong> ${car.vehicle_name || 'N/A'}</p>
                  ${car.description ? `<p>${car.description}</p>` : ''}
                </div>
              </div>

              <form method="POST" action="/judge/edit-vehicle/${car.car_id}">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Current Class</label>
                    <input type="text" value="${car.class_name || 'N/A'}" disabled>
                  </div>
                  <div class="form-group">
                    <label>New Class</label>
                    <select name="class_id" required>
                      ${classOptionsHtml}
                    </select>
                  </div>
                  <button type="submit">Update Class</button>
                </div>
              </form>

              <div class="links" style="margin-top:20px;">
                <a href="/judge/vehicles">&larr; Back to Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // Edit Vehicle Class - Save class change
  // ============================================================
  router.post('/edit-vehicle/:id', requireJudge, (req, res) => {
    const carId = req.params.id;
    const { class_id } = req.body;

    db.run('UPDATE cars SET class_id = ? WHERE car_id = ? AND is_active = 1', [class_id, carId], function(err) {
      if (err) {
        console.error('Error updating vehicle class:', err.message);
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          ${bodyTag(req)}
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating vehicle class. Please try again.</div>
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

  // ==========================================
  // JUDGE VENDOR BROWSING ROUTES
  // ==========================================

  // Vendors list
  router.get('/vendors', requireJudge, (req, res) => {
    const user = req.session.user;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];
      const nav = getNav('judge', 'vendors', chatEnabled);
      const header = dashboardHeader('judge', user, 'Judge Dashboard');
      res.send(renderVendorListPage({ vendors, user, role: 'judge', appConfig, nav, header, isAdmin: false }));
    });
  });

  // View vendor detail
  router.get('/vendors/:id', requireJudge, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/judge/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL) ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
        if (!products) products = [];
        const nav = getNav('judge', 'vendors', chatEnabled);
        const header = dashboardHeader('judge', user, 'Judge Dashboard');
        res.send(renderVendorDetailPage({ business, products, user, role: 'judge', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireJudge, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/judge/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/judge/vendors/${vendorUserId}`);
        const nav = getNav('judge', 'vendors', chatEnabled);
        const header = dashboardHeader('judge', user, 'Judge Dashboard');
        res.send(renderProductDetailPage({ product, business, user, role: 'judge', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  return router;
};
