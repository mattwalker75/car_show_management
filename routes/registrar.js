// routes/registrar.js - Registrar dashboard, vehicle management, and user management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireRegistrar, hashPassword } = require('../middleware/auth');
  const { errorPage } = require('../views/layout');
  const { styles, adminStyles, getBodyTag, getAppBgStyles } = require('../views/htmlHelpers');
  const { getInitials, getAvatarContent, registrarNav, isChatEnabled, profileButton, getNav, dashboardHeader } = require('../views/components');
  const { renderVendorListPage, renderVendorDetailPage, renderProductDetailPage } = require('../helpers/vendorViews');

  const appBgStyles = () => getAppBgStyles(appConfig);
  const bodyTag = (req) => getBodyTag(req, appConfig);

  // Safe JSON parse helper - returns default value if parsing fails
  const safeJsonParse = (jsonString, defaultValue = []) => {
    if (!jsonString) return defaultValue;
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      console.error('JSON parse error:', err.message);
      return defaultValue;
    }
  };

  // ── Registrar Dashboard ───────────────────────────────────────────────
  router.get('/', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get count of users for stats
    db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role = ? ORDER BY name', ['user'], (err, users) => {
      if (err) {
        users = [];
      }

      db.get('SELECT COUNT(*) as cnt FROM cars WHERE is_active = 1', (err, activeCount) => {
        db.get('SELECT COUNT(*) as cnt FROM cars WHERE is_active = 0', (err, pendingCount) => {
          const activeCars = activeCount ? activeCount.cnt : 0;
          const pendingCars = pendingCount ? pendingCount.cnt : 0;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registrar Dashboard - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="welcome-card">
              <h2>Welcome, ${user.name}!</h2>
              <p>Handle participant check-in and registration tasks.</p>
            </div>

            ${registrarNav('dashboard', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">${users.length}</div>
                <div class="stat-label">Registered Users</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${activeCars}</div>
                <div class="stat-label">Registered Vehicles</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${pendingCars}</div>
                <div class="stat-label">Unregistered Vehicles</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
        });
      });
    });
  });

  // ── User List ─────────────────────────────────────────────────────────
  router.get('/users', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get all users (not admins)
    db.all('SELECT user_id as id, username, name, email, phone, role, is_active, image_url FROM users WHERE role NOT IN (?, ?) ORDER BY name', ['admin', 'registrar'], (err, users) => {
      if (err) {
        users = [];
      }

      const userCards = users.map(u => `
        <div class="user-card" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}" onclick="window.location.href='/registrar/view-user/${u.id}'" style="cursor:pointer;">
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
              <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
            </div>
          </div>
        </div>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Users - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('users', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

            <h3 class="section-title">Users & Judges</h3>
            <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and judges.</p>

            <div style="margin-bottom:16px;">
              <input type="text" id="userSearch" placeholder="Search by name, login ID, email, or phone..." oninput="filterUsers()" style="width:100%;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
            </div>
            <div id="noResults" style="display:none;text-align:center;color:var(--text-secondary);padding:20px;font-size:14px;">No users match your search.</div>

            <div class="user-cards">
              ${userCards}
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar">&larr; Back to Dashboard</a>
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

  // ── View User (detail page) ──────────────────────────────────────────
  router.get('/view-user/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const userId = req.params.id;
    const avatarContent = getAvatarContent(user);

    db.get('SELECT user_id as id, username, name, email, phone, role, is_active, image_url FROM users WHERE user_id = ?', [userId], (err, viewUser) => {
      if (err || !viewUser) {
        res.redirect('/registrar/users');
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
          <div class="vehicle-card" onclick="window.location.href='/registrar/view-vehicle/${car.car_id}'" style="cursor:pointer;">
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
                <a href="/registrar/vendors/${viewUser.id}" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--container-bg);border:1px solid var(--card-border);border-radius:10px;text-decoration:none;color:var(--text-primary);font-weight:600;">
                  🏪 View Vendor Store
                </a>
              </div>` : '';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>View User - Registrar Dashboard</title>
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
                <h1>🏎️ Registrar</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              ${registrarNav('users', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

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
                <a href="/registrar/reset-password/${viewUser.id}" class="action-btn edit">Reset Password</a>
              </div>

              <div class="links" style="margin-top:20px;text-align:center;">
                <a href="/registrar/users">&larr; Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ── Reset Password (GET form) ─────────────────────────────────────────
  router.get('/reset-password/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);
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
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('users', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

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
            <div class="links" style="margin-top:20px;">
              <a href="/registrar/users">&larr; Back to Users</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ── Reset Password (POST handler) ─────────────────────────────────────
  router.post('/reset-password/:id', requireRegistrar, async (req, res) => {
    const userId = req.params.id;
    const { password, confirm_password } = req.body;

    // First verify the target user is not an admin or registrar
    db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role NOT IN (?, ?)', [userId, 'admin', 'registrar'], async (err, targetUser) => {
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
          ${bodyTag(req)}
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

      const hashedPassword = await hashPassword(password);
      db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role NOT IN (?, ?)', [hashedPassword, userId, 'admin', 'registrar'], function(err) {
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
            ${bodyTag(req)}
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

  // ── Vehicle List with Filters ─────────────────────────────────────────
  router.get('/vehicles', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    // Get all vehicles with owner info and class names
    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active,
            u.name as owner_name, u.username as owner_username, u.email as owner_email,
            cl.class_name, v.vehicle_name, v.registration_price
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            ORDER BY c.is_active ASC, c.created_at DESC`, (err, cars) => {
      if (err) {
        cars = [];
      }

      const pendingCount = cars.filter(c => !c.is_active).length;
      const activeCount = cars.filter(c => c.is_active).length;

      const vehicleCards = cars.map(car => {
        const price = car.registration_price || 0;
        return `
        <div class="vehicle-card ${car.is_active ? '' : 'pending'}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-status="${car.is_active ? 'active' : 'pending'}" data-voterid="${car.voter_id || ''}" data-price="${price.toFixed(2)}" onclick="window.location.href='/registrar/view-vehicle/${car.car_id}'" style="cursor:pointer;">
          <div class="vehicle-select" onclick="event.stopPropagation()">
            <input type="checkbox" class="vehicle-checkbox" data-price="${price.toFixed(2)}" data-carid="${car.car_id}" onchange="updateSelectionTotal()">
          </div>
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</div>
            <div class="vehicle-meta">${car.owner_name || 'Unknown'} &mdash; ${car.owner_email || 'N/A'}</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              <span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending Payment'}</span>
              ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
              <span class="price-badge">$${price.toFixed(2)}</span>
            </div>
          </div>
          <div class="vehicle-actions" onclick="event.stopPropagation()">
            <a href="/registrar/edit-vehicle/${car.car_id}" class="action-btn edit">${car.is_active ? 'Edit' : 'Activate'}</a>
          </div>
        </div>
      `}).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vehicles - Registrar Dashboard</title>
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
            .vehicle-card.pending {
              border: 2px dashed var(--deactivated-border);
              background: var(--warning-bg);
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
            .status-badge.active {
              background: var(--success-color);
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .status-badge.pending {
              background: var(--warning-color);
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
            }
            .vehicle-select {
              display: flex;
              align-items: center;
              padding: 0 4px;
            }
            .vehicle-checkbox {
              width: 20px;
              height: 20px;
              cursor: pointer;
              accent-color: var(--checkbox-accent);
            }
            .vehicle-card.selected {
              border-color: var(--checkbox-accent) !important;
              background: var(--info-highlight-bg) !important;
            }
            .price-badge {
              background: var(--success-color);
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 20px;
            }
            .summary-card {
              background: var(--card-bg);
              padding: 16px;
              border-radius: 12px;
              text-align: center;
            }
            .summary-card.pending-bg {
              background: var(--warning-bg);
              border: 1px solid var(--deactivated-border);
            }
            .summary-number {
              font-size: 28px;
              font-weight: 700;
              color: var(--text-primary);
            }
            .summary-label {
              font-size: 12px;
              color: var(--text-secondary);
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
            .vehicle-select {
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
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('vehicles', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

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

            <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="searchFilter" placeholder="Search by name, email, make, model, or voter ID..." oninput="filterVehicles()" style="flex:1;min-width:200px;font-size:16px;">
              <select id="statusFilter" onchange="filterVehicles()" style="min-width:140px;">
                <option value="">All Statuses</option>
                <option value="pending">Pending Payment</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div id="noResults" style="display:none;color:var(--text-secondary);text-align:center;padding:20px;">No vehicles match your filter.</div>

            <div id="vehicleList">
              ${cars.length > 0 ? vehicleCards : '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
            </div>

            <div id="selectionBar" style="display:none;position:sticky;bottom:0;left:0;right:0;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:white;padding:16px 20px;border-radius:12px;margin-top:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);z-index:100;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                  <span id="selectedCount" style="font-weight:700;font-size:18px;">0</span>
                  <span style="font-size:14px;opacity:0.8;"> vehicles selected</span>
                </div>
                <div style="font-size:22px;font-weight:700;">
                  Total: $<span id="selectedTotal">0.00</span>
                </div>
                <button onclick="clearSelection()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Clear Selection</button>
              </div>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar">&larr; Back to Dashboard</a>
            </div>
          </div>

          <script>
            function filterVehicles() {
              const search = document.getElementById('searchFilter').value.toLowerCase().trim();
              const status = document.getElementById('statusFilter').value;
              const cards = document.querySelectorAll('.vehicle-card');
              let visibleCount = 0;
              cards.forEach(card => {
                const name = card.dataset.name || '';
                const email = card.dataset.email || '';
                const make = card.dataset.make || '';
                const model = card.dataset.model || '';
                const voterid = card.dataset.voterid || '';
                const cardStatus = card.dataset.status || '';

                const matchesSearch = !search || name.includes(search) || email.includes(search) || make.includes(search) || model.includes(search) || voterid.includes(search);
                const matchesStatus = !status || cardStatus === status;

                if (matchesSearch && matchesStatus) {
                  card.style.display = '';
                  visibleCount++;
                } else {
                  card.style.display = 'none';
                }
              });
              document.getElementById('noResults').style.display = visibleCount === 0 && cards.length > 0 ? '' : 'none';
            }

            function updateSelectionTotal() {
              const checkboxes = document.querySelectorAll('.vehicle-checkbox');
              let count = 0;
              let total = 0;
              checkboxes.forEach(cb => {
                const card = cb.closest('.vehicle-card');
                if (cb.checked) {
                  count++;
                  total += parseFloat(cb.dataset.price) || 0;
                  card.classList.add('selected');
                } else {
                  card.classList.remove('selected');
                }
              });
              const bar = document.getElementById('selectionBar');
              if (count > 0) {
                bar.style.display = '';
                document.getElementById('selectedCount').textContent = count;
                document.getElementById('selectedTotal').textContent = total.toFixed(2);
              } else {
                bar.style.display = 'none';
              }
            }

            function clearSelection() {
              document.querySelectorAll('.vehicle-checkbox').forEach(cb => {
                cb.checked = false;
                cb.closest('.vehicle-card').classList.remove('selected');
              });
              document.getElementById('selectionBar').style.display = 'none';
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // ── View Vehicle (read-only detail) ───────────────────────────────────
  router.get('/view-vehicle/:id', requireRegistrar, (req, res) => {
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
        res.redirect('/registrar/vehicles');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>View Vehicle - Registrar Dashboard</title>
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
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('vehicles', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

            <h3 class="section-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h3>

            ${car.image_url
              ? `<div class="vehicle-detail-image" onclick="openImageModal('${car.image_url}', '${car.year ? car.year + ' ' : ''}${car.make} ${car.model}')"><img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}"></div>`
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
                <span class="detail-value"><span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending Payment'}</span></span>
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

            <a href="/registrar/view-user/${car.user_id}" style="text-decoration:none;color:inherit;display:block;">
              <div class="owner-details" style="cursor:pointer;transition:border-color 0.2s;">
                <h4>Owner Information</h4>
                <p><strong>Name:</strong> ${car.owner_name || 'Unknown'}</p>
                <p><strong>Username:</strong> @${car.owner_username || 'N/A'}</p>
                <p><strong>Email:</strong> ${car.owner_email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${car.owner_phone || 'N/A'}</p>
              </div>
            </a>

            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
              <a href="/registrar/edit-vehicle/${car.car_id}" class="action-btn edit">${car.is_active ? 'Edit' : 'Activate'}</a>
            </div>
            <div class="links" style="margin-top:20px;text-align:center;">
              <a href="/registrar/vehicles">&larr; Back to Vehicles</a>
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

  // ── Edit Vehicle (GET form) ───────────────────────────────────────────
  router.get('/edit-vehicle/:id', requireRegistrar, (req, res) => {
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
        res.redirect('/registrar/vehicles');
        return;
      }

      // Get next available voter ID
      db.get('SELECT COALESCE(MAX(voter_id), 0) + 1 as next_id FROM cars WHERE voter_id IS NOT NULL', (err, nextIdRow) => {
      const nextVoterId = nextIdRow ? nextIdRow.next_id : 1;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Vehicle - Registrar Dashboard</title>
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
              margin-bottom: 4px;
              font-size: 14px;
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
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                ${profileButton('registrar')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('vehicles', appConfig.chatEnabled !== false && req.session.user.chat_enabled)}

            <h3 class="section-title">${car.is_active ? 'Edit' : 'Activate'} Vehicle</h3>

            <div class="vehicle-preview">
              ${car.image_url
                ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}"></div>`
                : `<div class="vehicle-preview-placeholder">🚗</div>`
              }
              <div class="vehicle-preview-info">
                <h4>${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h4>
                <p><strong>Type:</strong> ${car.vehicle_name || 'N/A'}</p>
                <p><strong>Class:</strong> ${car.class_name || 'N/A'}</p>
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
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="text" name="voter_id" id="voterIdInput" value="${car.voter_id || ''}" placeholder="Assign a voter number" inputmode="numeric" style="flex:1;" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                    <button type="button" onclick="document.getElementById('voterIdInput').value='${nextVoterId}'" style="white-space:nowrap;background:var(--btn-edit-bg);color:var(--text-dark);padding:10px 16px;">Auto-Assign (#${nextVoterId})</button>
                  </div>
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

            <div class="links" style="margin-top:20px;">
              <a href="/registrar/vehicles">&larr; Back to Vehicles</a>
            </div>
          </div>
        </body>
        </html>
      `);
      }); // end nextVoterId query
    });
  });

  // ── Edit Vehicle (POST handler) ───────────────────────────────────────
  router.post('/edit-vehicle/:id', requireRegistrar, (req, res) => {
    const carId = req.params.id;
    const { voter_id, is_active } = req.body;

    // Check if voter_id is unique (if provided)
    if (voter_id && voter_id.trim() !== '') {
      db.get('SELECT car_id FROM cars WHERE voter_id = ? AND car_id != ?', [voter_id, carId], (err, existingCar) => {
        if (existingCar) {
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
                <div class="error-message">Voter ID "${voter_id}" is already assigned to another vehicle. Each vehicle must have a unique Voter ID.</div>
                <div class="links">
                  <a href="/registrar/edit-vehicle/${carId}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
          return;
        }

        // Voter ID is unique, proceed with update
        updateVehicle();
      });
    } else {
      // No voter_id provided, proceed with update
      updateVehicle();
    }

    function updateVehicle() {
      db.run('UPDATE cars SET voter_id = ?, is_active = ? WHERE car_id = ?', [voter_id || null, is_active, carId], function(err) {
        if (err) {
          console.error('Error updating vehicle:', err.message);
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
                <div class="error-message">Error updating vehicle. Please try again.</div>
                <div class="links">
                  <a href="/registrar/vehicles">Back to Vehicles</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          // If vehicle was activated, enable chat for the car owner
          if (String(is_active) === '1') {
            db.run('UPDATE users SET chat_enabled = 1 WHERE user_id = (SELECT user_id FROM cars WHERE car_id = ?) AND chat_enabled = 0', [carId], function() {});
          }
          res.redirect('/registrar/vehicles');
        }
      });
    }
  });


  // ==========================================
  // REGISTRAR VENDOR BROWSING ROUTES
  // ==========================================

  // Vendors list
  router.get('/vendors', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];
      const nav = getNav('registrar', 'vendors', chatEnabled);
      const header = dashboardHeader('registrar', user, 'Registrar Dashboard');
      res.send(renderVendorListPage({ vendors, user, role: 'registrar', appConfig, nav, header, isAdmin: false }));
    });
  });

  // View vendor detail
  router.get('/vendors/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/registrar/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL) ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
        if (!products) products = [];
        const nav = getNav('registrar', 'vendors', chatEnabled);
        const header = dashboardHeader('registrar', user, 'Registrar Dashboard');
        res.send(renderVendorDetailPage({ business, products, user, role: 'registrar', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/registrar/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/registrar/vendors/${vendorUserId}`);
        const nav = getNav('registrar', 'vendors', chatEnabled);
        const header = dashboardHeader('registrar', user, 'Registrar Dashboard');
        res.send(renderProductDetailPage({ product, business, user, role: 'registrar', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  // ============================================================================
  // REGISTRATION TAB - Transaction Management
  // ============================================================================

  // ── Registration Main Page (shows active transactions) ─────────────────────
  router.get('/registration', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    // Get active transactions
    db.all(`SELECT rt.*, u.name as customer_name, u.username as customer_username, r.name as registrar_name
            FROM registration_transactions rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN users r ON rt.registrar_id = r.user_id
            WHERE rt.status = 'active'
            ORDER BY rt.created_at DESC`, (err, activeTransactions) => {
      if (err) activeTransactions = [];

      const transactionCards = activeTransactions.map(t => {
        const vehicles = safeJsonParse(t.vehicles_json);
        const products = safeJsonParse(t.products_json);
        const vehicleCount = vehicles.length;
        const productCount = products.reduce((sum, p) => sum + (p.quantity || 1), 0);

        return `
          <div class="transaction-card" onclick="window.location.href='/registrar/registration/edit/${t.transaction_id}'" style="cursor:pointer;">
            <div class="transaction-info">
              <div class="transaction-customer">${t.customer_name || 'Unknown'} <span style="color:var(--text-muted);font-size:13px;">@${t.customer_username || 'N/A'}</span></div>
              <div class="transaction-summary">
                ${vehicleCount > 0 ? `<span class="transaction-badge">${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}</span>` : ''}
                ${productCount > 0 ? `<span class="transaction-badge products">${productCount} product${productCount !== 1 ? 's' : ''}</span>` : ''}
              </div>
              <div class="transaction-total">Total: $${t.total_amount || '0.00'}</div>
              <div class="transaction-meta">Started ${new Date(t.created_at).toLocaleString()} by ${t.registrar_name || 'Unknown'}</div>
            </div>
          </div>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          <style>
            .transaction-card {
              background: var(--card-bg);
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 12px;
              border: 2px solid var(--warning-color);
              transition: all 0.2s;
            }
            .transaction-card:hover {
              border-color: var(--accent-primary);
              box-shadow: 0 2px 10px var(--container-shadow);
            }
            .transaction-customer {
              font-size: 16px;
              font-weight: 700;
              color: var(--text-primary);
              margin-bottom: 8px;
            }
            .transaction-summary {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
              margin-bottom: 8px;
            }
            .transaction-badge {
              background: var(--btn-edit-bg);
              color: white;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
            }
            .transaction-badge.products {
              background: var(--role-vendor);
            }
            .transaction-total {
              font-size: 18px;
              font-weight: 700;
              color: var(--success-color);
              margin-bottom: 4px;
            }
            .transaction-meta {
              font-size: 12px;
              color: var(--text-muted);
            }
            .action-buttons {
              display: flex;
              gap: 12px;
              margin-top: 20px;
            }
            .action-buttons a {
              flex: 1;
              padding: 16px 24px;
              border-radius: 10px;
              text-align: center;
              text-decoration: none;
              font-weight: 600;
              font-size: 16px;
            }
            .btn-new {
              background: var(--success-color);
              color: white;
            }
            .btn-history {
              background: var(--btn-secondary-bg);
              color: white;
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${user.image_url ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(user.name)}</div>
                <a href="/registrar/profile" class="profile-btn">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('registration', chatEnabled)}

            <h3 class="section-title">Active Transactions</h3>

            ${activeTransactions.length > 0
              ? transactionCards
              : '<p style="color:var(--text-muted);text-align:center;padding:20px;font-style:italic;">No active transactions. Click "New" to start a registration.</p>'
            }

            <div class="action-buttons">
              <a href="/registrar/registration/new" class="btn-new">+ New</a>
              <a href="/registrar/registration/history" class="btn-history">History</a>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar">&larr; Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ── New Transaction - Select User ──────────────────────────────────────────
  router.get('/registration/new', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    // Get all users (not admin/judge/registrar)
    db.all(`SELECT user_id as id, username, name, email, phone FROM users
            WHERE role = 'user' AND is_active = 1
            ORDER BY name`, (err, users) => {
      if (err) users = [];

      const userOptions = users.map(u =>
        `<option value="${u.id}" data-name="${u.name}" data-username="${u.username}" data-email="${u.email || ''}">${u.name} (@${u.username}) - ${u.email || 'No email'}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>New Registration - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          <style>
            .search-box {
              width: 100%;
              padding: 14px 16px;
              border: 2px solid var(--input-border);
              border-radius: 10px;
              font-size: 16px;
              margin-bottom: 12px;
            }
            .search-box:focus {
              border-color: var(--input-focus-border);
              outline: none;
            }
            .user-select-card {
              background: var(--card-bg);
              border-radius: 10px;
              padding: 14px;
              margin-bottom: 8px;
              border: 1px solid var(--card-border);
              cursor: pointer;
              transition: all 0.2s;
            }
            .user-select-card:hover {
              border-color: var(--accent-primary);
              background: var(--input-bg);
            }
            .user-select-card.hidden {
              display: none;
            }
            .user-select-name {
              font-weight: 600;
              color: var(--text-primary);
            }
            .user-select-details {
              font-size: 13px;
              color: var(--text-secondary);
              margin-top: 4px;
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${user.image_url ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(user.name)}</div>
                <a href="/registrar/profile" class="profile-btn">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('registration', chatEnabled)}

            <h3 class="section-title">Select Customer</h3>
            <p style="color:var(--text-secondary);margin-bottom:15px;">Search by name, username, or email to find the customer.</p>

            <input type="text" id="userSearch" class="search-box" placeholder="Search by name, username, or email..." autofocus>

            <div id="userList">
              ${users.map(u => `
                <div class="user-select-card" data-name="${(u.name || '').toLowerCase()}" data-username="${(u.username || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" onclick="selectUser(${u.id})">
                  <div class="user-select-name">${u.name}</div>
                  <div class="user-select-details">@${u.username}${u.email ? ' · ' + u.email : ''}${u.phone ? ' · ' + u.phone : ''}</div>
                </div>
              `).join('')}
            </div>

            ${users.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px;">No users found. Users need to register first.</p>' : ''}

            <div class="links" style="margin-top:20px;">
              <a href="/registrar/registration">&larr; Back to Registration</a>
            </div>
          </div>

          <script>
            function selectUser(userId) {
              window.location.href = '/registrar/registration/create/' + userId;
            }

            document.getElementById('userSearch').addEventListener('input', function() {
              var search = this.value.toLowerCase();
              var cards = document.querySelectorAll('.user-select-card');
              cards.forEach(function(card) {
                var name = card.getAttribute('data-name');
                var username = card.getAttribute('data-username');
                var email = card.getAttribute('data-email');
                if (name.indexOf(search) > -1 || username.indexOf(search) > -1 || email.indexOf(search) > -1) {
                  card.classList.remove('hidden');
                } else {
                  card.classList.add('hidden');
                }
              });
            });
          </script>
        </body>
        </html>
      `);
    });
  });

  // ── Create Transaction for User ────────────────────────────────────────────
  router.get('/registration/create/:userId', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const customerId = req.params.userId;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    // Get customer info
    db.get('SELECT user_id as id, username, name, email, phone FROM users WHERE user_id = ? AND role = ? AND is_active = 1',
      [customerId, 'user'], (err, customer) => {
      if (err || !customer) {
        return res.redirect('/registrar/registration/new');
      }

      // Get customer's unregistered vehicles (is_active = 0 means pending)
      db.all(`SELECT c.*, v.vehicle_name, v.registration_price, cl.class_name
              FROM cars c
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              LEFT JOIN classes cl ON c.class_id = cl.class_id
              WHERE c.user_id = ? AND c.is_active = 0
              ORDER BY c.make, c.model`, [customerId], (err, vehicles) => {
        if (err) vehicles = [];

        // Get available products
        db.all('SELECT * FROM products WHERE available = 1 AND admin_deactivated = 0 ORDER BY display_order, product_name', (err, products) => {
          if (err) products = [];

          // Create the transaction
          db.run('INSERT INTO registration_transactions (user_id, registrar_id, vehicles_json, products_json, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
            [customerId, user.user_id, '[]', '[]', '0.00', 'active'],
            function(err) {
              if (err) {
                console.error('Error creating transaction:', err.message);
                return res.send(errorPage('Error creating transaction. Please try again.', '/registrar/registration/new', 'Try Again'));
              }
              const transactionId = this.lastID;
              res.redirect(`/registrar/registration/edit/${transactionId}`);
            });
        });
      });
    });
  });

  // ── Edit Transaction ───────────────────────────────────────────────────────
  router.get('/registration/edit/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const transactionId = req.params.id;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    // Get transaction with customer info
    db.get(`SELECT rt.*, u.name as customer_name, u.username as customer_username, u.email as customer_email
            FROM registration_transactions rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            WHERE rt.transaction_id = ? AND rt.status = 'active'`, [transactionId], (err, transaction) => {
      if (err || !transaction) {
        return res.redirect('/registrar/registration');
      }

      // Get customer's unregistered vehicles
      db.all(`SELECT c.*, v.vehicle_name, v.registration_price, cl.class_name
              FROM cars c
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              LEFT JOIN classes cl ON c.class_id = cl.class_id
              WHERE c.user_id = ? AND c.is_active = 0
              ORDER BY c.make, c.model`, [transaction.user_id], (err, availableVehicles) => {
        if (err) availableVehicles = [];

        // Get available products
        db.all('SELECT * FROM products WHERE available = 1 AND admin_deactivated = 0 ORDER BY display_order, product_name', (err, products) => {
          if (err) products = [];

          // Get the next available voter ID
          db.get('SELECT COALESCE(MAX(CAST(voter_id AS INTEGER)), 0) + 1 as next_id FROM cars WHERE voter_id IS NOT NULL', (err, nextIdRow) => {
            const nextVoterId = nextIdRow ? nextIdRow.next_id : 1;

          const selectedVehicles = safeJsonParse(transaction.vehicles_json);
          const selectedProducts = safeJsonParse(transaction.products_json);
          const selectedVehicleIds = new Set(selectedVehicles.map(v => v.car_id));
          const selectedProductMap = new Map(selectedProducts.map(p => [p.product_id, p.quantity]));

          // Mark vehicles that are already in transaction
          const vehicleCards = availableVehicles.map(v => {
            const isSelected = selectedVehicleIds.has(v.car_id);
            const price = v.registration_price || 25;
            return `
              <div class="item-card ${isSelected ? 'selected' : ''}" id="vehicle-${v.car_id}">
                <label class="item-checkbox">
                  <input type="checkbox" name="vehicles" value="${v.car_id}" data-price="${price}" ${isSelected ? 'checked' : ''} onchange="updateTotals()">
                  <span class="checkmark"></span>
                </label>
                <div class="item-info">
                  <div class="item-name">${v.year ? v.year + ' ' : ''}${v.make} ${v.model}</div>
                  <div class="item-details">
                    ${v.vehicle_name ? `<span class="item-badge">${v.vehicle_name}</span>` : ''}
                    ${v.class_name ? `<span class="item-badge class">${v.class_name}</span>` : ''}
                  </div>
                  <div class="voter-id-row">
                    <label>Voter ID:</label>
                    <input type="text" name="voter_id_${v.car_id}" id="voter_id_${v.car_id}" value="${v.voter_id || ''}" placeholder="#" inputmode="numeric" maxlength="5" class="voter-id-input" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,5)">
                    <button type="button" class="auto-assign-btn" onclick="autoAssignVoterId(${v.car_id})">Auto</button>
                  </div>
                </div>
                <div class="item-price">$${parseFloat(price).toFixed(2)}</div>
              </div>
            `;
          }).join('');

          const productCards = products.map(p => {
            const qty = selectedProductMap.get(p.product_id) || 0;
            const price = p.discount_price || p.price;
            return `
              <div class="item-card product ${qty > 0 ? 'selected' : ''}" id="product-${p.product_id}">
                <div class="item-info">
                  <div class="item-name">${p.product_name}</div>
                  ${p.description ? `<div class="item-desc">${p.description}</div>` : ''}
                </div>
                <div class="item-price">
                  ${p.discount_price ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:12px;">$${p.price}</span> ` : ''}
                  $${parseFloat(price).toFixed(2)}
                </div>
                <div class="quantity-control">
                  <button type="button" onclick="changeQty(${p.product_id}, -1, ${price})" class="qty-btn">-</button>
                  <input type="number" id="qty-${p.product_id}" name="product-${p.product_id}" value="${qty}" min="0" max="99" data-price="${price}" onchange="updateTotals()" onblur="updateTotals()">
                  <button type="button" onclick="changeQty(${p.product_id}, 1, ${price})" class="qty-btn">+</button>
                </div>
              </div>
            `;
          }).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Edit Registration - Registrar Dashboard</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
              ${appBgStyles()}
              <style>
                .customer-header {
                  background: var(--info-highlight-bg);
                  padding: 16px;
                  border-radius: 12px;
                  margin-bottom: 20px;
                }
                .customer-name {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--info-highlight-text);
                }
                .customer-details {
                  font-size: 14px;
                  color: var(--text-secondary);
                  margin-top: 4px;
                }
                .item-card {
                  background: var(--card-bg);
                  border-radius: 10px;
                  padding: 14px;
                  margin-bottom: 10px;
                  border: 2px solid var(--card-border);
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  transition: all 0.2s;
                }
                .item-card.selected {
                  border-color: var(--success-color);
                  background: rgba(39, 174, 96, 0.1);
                }
                .item-checkbox {
                  position: relative;
                  width: 24px;
                  height: 24px;
                  flex-shrink: 0;
                }
                .item-checkbox input {
                  opacity: 0;
                  width: 0;
                  height: 0;
                }
                .checkmark {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 24px;
                  height: 24px;
                  background: var(--input-bg);
                  border: 2px solid var(--input-border);
                  border-radius: 6px;
                }
                .item-checkbox input:checked + .checkmark {
                  background: var(--success-color);
                  border-color: var(--success-color);
                }
                .checkmark:after {
                  content: "";
                  position: absolute;
                  display: none;
                  left: 7px;
                  top: 3px;
                  width: 6px;
                  height: 12px;
                  border: solid white;
                  border-width: 0 2px 2px 0;
                  transform: rotate(45deg);
                }
                .item-checkbox input:checked + .checkmark:after {
                  display: block;
                }
                .item-info {
                  flex: 1;
                  min-width: 0;
                }
                .item-name {
                  font-weight: 600;
                  color: var(--text-primary);
                }
                .item-desc {
                  font-size: 12px;
                  color: var(--text-muted);
                }
                .item-details {
                  display: flex;
                  gap: 6px;
                  margin-top: 4px;
                  flex-wrap: wrap;
                }
                .item-badge {
                  background: var(--btn-edit-bg);
                  color: white;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                }
                .item-badge.class {
                  background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                }
                .voter-id-row {
                  display: flex;
                  align-items: center;
                  justify-content: flex-end;
                  gap: 6px;
                  margin-top: 8px;
                }
                .voter-id-row label {
                  font-size: 11px;
                  color: var(--text-muted);
                  white-space: nowrap;
                }
                input.voter-id-input[type="text"] {
                  width: 60px;
                  height: 32px;
                  padding: 0 4px;
                  font-size: 16px;
                  font-weight: 600;
                  border: 2px solid var(--input-border);
                  border-radius: 6px;
                  background: var(--input-bg);
                  color: var(--text-primary);
                  text-align: center;
                }
                input.voter-id-input[type="text"]:focus {
                  border-color: var(--accent-color);
                  outline: none;
                  box-shadow: none;
                }
                .auto-assign-btn {
                  padding: 4px 10px;
                  font-size: 12px;
                  font-weight: 600;
                  border: none;
                  border-radius: 6px;
                  background: var(--btn-secondary-bg);
                  color: white;
                  cursor: pointer;
                  white-space: nowrap;
                }
                .auto-assign-btn:hover {
                  opacity: 0.9;
                }
                .auto-assign-btn:active {
                  opacity: 0.8;
                }
                .item-price {
                  font-weight: 700;
                  color: var(--success-color);
                  font-size: 16px;
                  white-space: nowrap;
                }
                .quantity-control {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                }
                .qty-btn {
                  width: 32px;
                  height: 32px;
                  border: none;
                  background: var(--btn-secondary-bg);
                  color: white;
                  border-radius: 6px;
                  font-size: 18px;
                  font-weight: 700;
                  cursor: pointer;
                }
                .qty-btn:active {
                  opacity: 0.8;
                }
                .quantity-control input[type="number"] {
                  width: 60px;
                  height: 32px;
                  text-align: center;
                  font-size: 16px;
                  font-weight: 600;
                  border: 2px solid var(--input-border);
                  border-radius: 6px;
                  background: var(--input-bg);
                  color: var(--text-primary);
                  padding: 0 4px;
                  -moz-appearance: textfield;
                }
                .quantity-control input[type="number"]::-webkit-outer-spin-button,
                .quantity-control input[type="number"]::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                .totals-section {
                  background: var(--card-bg);
                  border-radius: 12px;
                  padding: 16px;
                  margin: 20px 0;
                  border: 2px solid var(--card-border);
                }
                .total-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px solid var(--divider-color);
                }
                .total-row:last-child {
                  border-bottom: none;
                  font-size: 20px;
                  font-weight: 700;
                  color: var(--success-color);
                  padding-top: 12px;
                }
                .action-buttons {
                  display: flex;
                  gap: 12px;
                  margin-top: 20px;
                }
                .action-buttons button, .action-buttons a {
                  flex: 1;
                  padding: 14px 20px;
                  border-radius: 10px;
                  text-align: center;
                  text-decoration: none;
                  font-weight: 600;
                  font-size: 15px;
                  border: none;
                  cursor: pointer;
                }
                .btn-save { background: var(--btn-edit-bg); color: white; }
                .btn-complete { background: var(--success-color); color: white; }
                .btn-cancel { background: var(--btn-delete-bg); color: white; }
                .section-subtitle {
                  font-size: 16px;
                  font-weight: 600;
                  color: var(--text-primary);
                  margin: 20px 0 12px;
                  padding-bottom: 8px;
                  border-bottom: 1px solid var(--divider-color);
                }
                .empty-message {
                  color: var(--text-muted);
                  text-align: center;
                  padding: 20px;
                  font-style: italic;
                }
              </style>
            </head>
            ${bodyTag(req)}
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Registrar</h1>
                  <div class="user-info">
                    <div class="user-avatar">${user.image_url ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(user.name)}</div>
                    <a href="/registrar/profile" class="profile-btn">Profile</a>
                    <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                ${registrarNav('registration', chatEnabled)}

                <div class="customer-header">
                  <div class="customer-name">${transaction.customer_name}</div>
                  <div class="customer-details">@${transaction.customer_username}${transaction.customer_email ? ' · ' + transaction.customer_email : ''}</div>
                </div>

                <form id="transactionForm" method="POST" action="/registrar/registration/save/${transactionId}">
                  <h4 class="section-subtitle">Vehicle Registration</h4>
                  ${availableVehicles.length > 0
                    ? vehicleCards
                    : '<p class="empty-message">No pending vehicles to register. All vehicles are already registered.</p>'
                  }

                  <h4 class="section-subtitle">Products</h4>
                  ${products.length > 0
                    ? productCards
                    : '<p class="empty-message">No products available.</p>'
                  }

                  <div class="totals-section">
                    <div class="total-row">
                      <span>Vehicles Subtotal</span>
                      <span id="vehicleSubtotal">$0.00</span>
                    </div>
                    <div class="total-row">
                      <span>Products Subtotal</span>
                      <span id="productSubtotal">$0.00</span>
                    </div>
                    <div class="total-row">
                      <span>Total</span>
                      <span id="grandTotal">$0.00</span>
                    </div>
                  </div>

                  <input type="hidden" name="total_amount" id="totalAmountInput" value="0.00">

                  <div class="action-buttons">
                    <button type="submit" name="action" value="save" class="btn-save">Save</button>
                    <button type="button" class="btn-complete" onclick="confirmComplete()">Complete</button>
                  </div>
                  <input type="hidden" name="action" id="actionInput" value="save">
                </form>

                <form method="POST" action="/registrar/registration/cancel/${transactionId}" style="margin-top:12px;">
                  <button type="submit" class="btn-cancel" style="width:100%;" onclick="return confirm('Are you sure you want to cancel this transaction?')">Cancel Transaction</button>
                </form>

                <div class="links" style="margin-top:20px;">
                  <a href="/registrar/registration">&larr; Back to Registration</a>
                </div>
              </div>

              <script>
                // Next available voter ID from server
                var nextVoterId = ${nextVoterId};

                function autoAssignVoterId(carId) {
                  var input = document.getElementById('voter_id_' + carId);
                  // Find the highest voter ID currently in any input field
                  var maxInForm = nextVoterId - 1;
                  document.querySelectorAll('.voter-id-input').forEach(function(inp) {
                    var val = parseInt(inp.value);
                    if (!isNaN(val) && val > maxInForm) {
                      maxInForm = val;
                    }
                  });
                  // Assign the next available ID
                  input.value = maxInForm + 1;
                  input.focus();
                  input.select();
                }

                function changeQty(productId, delta, price) {
                  var input = document.getElementById('qty-' + productId);
                  var newVal = Math.max(0, parseInt(input.value || 0) + delta);
                  input.value = newVal;
                  var card = document.getElementById('product-' + productId);
                  if (newVal > 0) {
                    card.classList.add('selected');
                  } else {
                    card.classList.remove('selected');
                  }
                  updateTotals();
                }

                function updateTotals() {
                  var vehicleTotal = 0;
                  var productTotal = 0;

                  // Calculate vehicle totals
                  document.querySelectorAll('input[name="vehicles"]:checked').forEach(function(cb) {
                    vehicleTotal += parseFloat(cb.dataset.price) || 0;
                    document.getElementById('vehicle-' + cb.value).classList.add('selected');
                  });
                  document.querySelectorAll('input[name="vehicles"]:not(:checked)').forEach(function(cb) {
                    document.getElementById('vehicle-' + cb.value).classList.remove('selected');
                  });

                  // Calculate product totals
                  document.querySelectorAll('input[type="number"][id^="qty-"]').forEach(function(input) {
                    var qty = parseInt(input.value) || 0;
                    var price = parseFloat(input.dataset.price) || 0;
                    productTotal += qty * price;
                  });

                  var grandTotal = vehicleTotal + productTotal;

                  document.getElementById('vehicleSubtotal').textContent = '$' + vehicleTotal.toFixed(2);
                  document.getElementById('productSubtotal').textContent = '$' + productTotal.toFixed(2);
                  document.getElementById('grandTotal').textContent = '$' + grandTotal.toFixed(2);
                  document.getElementById('totalAmountInput').value = grandTotal.toFixed(2);
                }

                // Initialize totals on page load
                updateTotals();

                function confirmComplete() {
                  var total = document.getElementById('totalAmountInput').value;
                  var totalFormatted = '$' + parseFloat(total).toFixed(2);

                  if (confirm('Complete this transaction?\\n\\nTotal Amount Due: ' + totalFormatted + '\\n\\nClick OK to complete or Cancel to go back.')) {
                    document.getElementById('actionInput').value = 'complete';
                    document.getElementById('transactionForm').submit();
                  }
                }
              </script>
            </body>
            </html>
          `);
          }); // close nextVoterId query
        });
      });
    });
  });

  // ── Save Transaction ───────────────────────────────────────────────────────
  router.post('/registration/save/:id', requireRegistrar, (req, res) => {
    const transactionId = req.params.id;
    const { action, total_amount } = req.body;

    // Get transaction to verify it's active
    db.get('SELECT * FROM registration_transactions WHERE transaction_id = ? AND status = ?', [transactionId, 'active'], (err, transaction) => {
      if (err || !transaction) {
        return res.redirect('/registrar/registration');
      }

      // Build vehicles JSON
      const vehicleIds = Array.isArray(req.body.vehicles) ? req.body.vehicles : (req.body.vehicles ? [req.body.vehicles] : []);

      // Collect voter IDs from form (voter_id_<car_id>)
      const voterIdUpdates = [];
      for (const key of Object.keys(req.body)) {
        if (key.startsWith('voter_id_')) {
          const carId = parseInt(key.replace('voter_id_', ''));
          const voterId = req.body[key] ? req.body[key].trim() : null;
          if (carId && voterId) {
            voterIdUpdates.push({ car_id: carId, voter_id: voterId });
          }
        }
      }

      // Get vehicle details for the JSON
      if (vehicleIds.length > 0) {
        db.all(`SELECT c.car_id, c.year, c.make, c.model, v.registration_price as price
                FROM cars c
                LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
                WHERE c.car_id IN (${vehicleIds.map(() => '?').join(',')})`, vehicleIds, (err, vehicles) => {
          if (err) vehicles = [];

          const vehiclesJson = JSON.stringify(vehicles.map(v => ({
            car_id: v.car_id,
            year: v.year,
            make: v.make,
            model: v.model,
            price: (v.price || 25).toFixed(2)
          })));

          // Build products JSON
          const productsJson = [];
          for (const key of Object.keys(req.body)) {
            if (key.startsWith('product-')) {
              const productId = parseInt(key.replace('product-', ''));
              const qty = parseInt(req.body[key]) || 0;
              if (qty > 0) {
                productsJson.push({ product_id: productId, quantity: qty });
              }
            }
          }

          // Get product names and prices
          if (productsJson.length > 0) {
            const productIds = productsJson.map(p => p.product_id);
            db.all(`SELECT product_id, product_name, price, discount_price FROM products WHERE product_id IN (${productIds.map(() => '?').join(',')})`, productIds, (err, prods) => {
              const prodMap = new Map(prods.map(p => [p.product_id, p]));
              const finalProducts = productsJson.map(p => {
                const prod = prodMap.get(p.product_id);
                return {
                  product_id: p.product_id,
                  name: prod ? prod.product_name : 'Unknown',
                  quantity: p.quantity,
                  price: prod ? (prod.discount_price || prod.price) : '0.00'
                };
              });

              completeUpdate(vehiclesJson, JSON.stringify(finalProducts));
            });
          } else {
            completeUpdate(vehiclesJson, '[]');
          }
        });
      } else {
        // No vehicles selected
        const productsJson = [];
        for (const key of Object.keys(req.body)) {
          if (key.startsWith('product-')) {
            const productId = parseInt(key.replace('product-', ''));
            const qty = parseInt(req.body[key]) || 0;
            if (qty > 0) {
              productsJson.push({ product_id: productId, quantity: qty });
            }
          }
        }

        if (productsJson.length > 0) {
          const productIds = productsJson.map(p => p.product_id);
          db.all(`SELECT product_id, product_name, price, discount_price FROM products WHERE product_id IN (${productIds.map(() => '?').join(',')})`, productIds, (err, prods) => {
            const prodMap = new Map((prods || []).map(p => [p.product_id, p]));
            const finalProducts = productsJson.map(p => {
              const prod = prodMap.get(p.product_id);
              return {
                product_id: p.product_id,
                name: prod ? prod.product_name : 'Unknown',
                quantity: p.quantity,
                price: prod ? (prod.discount_price || prod.price) : '0.00'
              };
            });

            completeUpdate('[]', JSON.stringify(finalProducts));
          });
        } else {
          completeUpdate('[]', '[]');
        }
      }

      function completeUpdate(vehiclesJson, productsJson) {
        // First, validate and update voter IDs if any are provided
        if (voterIdUpdates.length > 0) {
          // Check for duplicate voter IDs in the form submission
          const voterIdValues = voterIdUpdates.map(u => u.voter_id);
          const duplicatesInForm = voterIdValues.filter((v, i) => voterIdValues.indexOf(v) !== i);
          if (duplicatesInForm.length > 0) {
            return res.send(errorPage(`Duplicate Voter ID "${duplicatesInForm[0]}" entered for multiple vehicles. Each vehicle must have a unique Voter ID.`, `/registrar/registration/edit/${transactionId}`, 'Try Again'));
          }

          // Check for conflicts with existing voter IDs in database
          const carIds = voterIdUpdates.map(u => u.car_id);
          const placeholders = voterIdValues.map(() => '?').join(',');
          const carIdPlaceholders = carIds.map(() => '?').join(',');

          db.all(`SELECT car_id, voter_id FROM cars WHERE voter_id IN (${placeholders}) AND car_id NOT IN (${carIdPlaceholders})`,
            [...voterIdValues, ...carIds], (err, conflicts) => {
              if (err) {
                console.error('Error checking voter IDs:', err.message);
                return res.send(errorPage('Error validating voter IDs. Please try again.', `/registrar/registration/edit/${transactionId}`, 'Try Again'));
              }

              if (conflicts && conflicts.length > 0) {
                const conflictId = conflicts[0].voter_id;
                return res.send(errorPage(`Voter ID "${conflictId}" is already assigned to another vehicle. Each vehicle must have a unique Voter ID.`, `/registrar/registration/edit/${transactionId}`, 'Try Again'));
              }

              // No conflicts, proceed with voter ID updates
              updateVoterIds(() => {
                finishSave(vehiclesJson, productsJson);
              });
            });
        } else {
          // No voter IDs to update, proceed directly
          finishSave(vehiclesJson, productsJson);
        }

        function updateVoterIds(callback) {
          let pending = voterIdUpdates.length;
          if (pending === 0) return callback();

          voterIdUpdates.forEach(update => {
            db.run('UPDATE cars SET voter_id = ? WHERE car_id = ?', [update.voter_id, update.car_id], (err) => {
              if (err) console.error('Error updating voter_id:', err.message);
              pending--;
              if (pending === 0) callback();
            });
          });
        }

        function finishSave(vehiclesJson, productsJson) {
          if (action === 'complete') {
            // Mark transaction as complete and activate vehicles
            const vehicleIds = safeJsonParse(vehiclesJson).map(v => v.car_id);

            // Update transaction
            db.run('UPDATE registration_transactions SET vehicles_json = ?, products_json = ?, total_amount = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE transaction_id = ?',
              [vehiclesJson, productsJson, total_amount, 'complete', transactionId], (err) => {
                if (err) {
                  console.error('Error completing transaction:', err.message);
                  return res.send(errorPage('Error completing transaction. Please try again.', `/registrar/registration/edit/${transactionId}`, 'Try Again'));
                }

                // Activate the vehicles
                if (vehicleIds.length > 0) {
                  db.run(`UPDATE cars SET is_active = 1 WHERE car_id IN (${vehicleIds.map(() => '?').join(',')})`, vehicleIds, () => {
                    res.redirect('/registrar/registration');
                  });
                } else {
                  res.redirect('/registrar/registration');
                }
              });
          } else {
            // Just save, don't complete
            db.run('UPDATE registration_transactions SET vehicles_json = ?, products_json = ?, total_amount = ? WHERE transaction_id = ?',
              [vehiclesJson, productsJson, total_amount, transactionId], (err) => {
                if (err) {
                  console.error('Error saving transaction:', err.message);
                  return res.send(errorPage('Error saving transaction. Please try again.', `/registrar/registration/edit/${transactionId}`, 'Try Again'));
                }
                res.redirect('/registrar/registration');
              });
          }
        }
      }
    });
  });

  // ── Cancel Transaction ─────────────────────────────────────────────────────
  router.post('/registration/cancel/:id', requireRegistrar, (req, res) => {
    const transactionId = req.params.id;

    // Check if transaction has any items
    db.get('SELECT vehicles_json, products_json FROM registration_transactions WHERE transaction_id = ? AND status = ?',
      [transactionId, 'active'], (err, transaction) => {
        if (err || !transaction) {
          return res.redirect('/registrar/registration');
        }

        const vehicles = safeJsonParse(transaction.vehicles_json);
        const products = safeJsonParse(transaction.products_json);
        const hasItems = vehicles.length > 0 || products.some(p => (p.quantity || 0) > 0);

        if (hasItems) {
          // Has items - mark as cancelled (keep record)
          db.run('UPDATE registration_transactions SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE transaction_id = ?',
            ['cancel', transactionId], (err) => {
              res.redirect('/registrar/registration');
            });
        } else {
          // No items - delete the transaction entirely
          db.run('DELETE FROM registration_transactions WHERE transaction_id = ?', [transactionId], (err) => {
            res.redirect('/registrar/registration');
          });
        }
      });
  });

  // ── Transaction History ────────────────────────────────────────────────────
  router.get('/registration/history', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    // Get completed and cancelled transactions
    db.all(`SELECT rt.*, u.name as customer_name, u.username as customer_username, u.email as customer_email, r.name as registrar_name
            FROM registration_transactions rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN users r ON rt.registrar_id = r.user_id
            WHERE rt.status IN ('complete', 'cancel')
            ORDER BY rt.completed_at DESC`, (err, transactions) => {
      if (err) transactions = [];

      const transactionRows = transactions.map(t => {
        const vehicles = safeJsonParse(t.vehicles_json);
        const products = safeJsonParse(t.products_json);
        const vehicleCount = vehicles.length;
        const productCount = products.reduce((sum, p) => sum + (p.quantity || 1), 0);
        const statusClass = t.status === 'complete' ? 'active' : 'inactive';
        const statusText = t.status === 'complete' ? 'Completed' : 'Cancelled';

        return `
          <tr class="transaction-row" data-status="${t.status}" data-name="${(t.customer_name || '').toLowerCase()}" data-username="${(t.customer_username || '').toLowerCase()}" data-email="${(t.customer_email || '').toLowerCase()}" data-userid="${t.user_id}" onclick="window.location.href='/registrar/registration/view/${t.transaction_id}'" style="cursor:pointer;">
            <td>${t.customer_name || 'Unknown'}</td>
            <td>${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}, ${productCount} product${productCount !== 1 ? 's' : ''}</td>
            <td>$${t.total_amount || '0.00'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${t.completed_at ? new Date(t.completed_at).toLocaleString() : 'N/A'}</td>
          </tr>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transaction History - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${user.image_url ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(user.name)}</div>
                <a href="/registrar/profile" class="profile-btn">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('registration', chatEnabled)}

            <h3 class="section-title">Transaction History</h3>

            <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="searchFilter" placeholder="Search by name, username, email, or user ID..." oninput="filterTransactions()" style="flex:1;min-width:200px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
              <select id="statusFilter" onchange="filterTransactions()" style="min-width:140px;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;background:var(--input-bg);color:var(--text-primary);">
                <option value="">All Transactions</option>
                <option value="complete">Completed</option>
                <option value="cancel">Cancelled</option>
              </select>
            </div>
            <div id="noResults" style="display:none;color:var(--text-secondary);text-align:center;padding:20px;">No transactions match your filter.</div>

            <div class="table-wrapper config-table">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody id="transactionBody">
                  ${transactionRows || '<tr id="emptyRow"><td colspan="5" style="text-align:center;color:var(--text-secondary);">No transaction history yet.</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar/registration">&larr; Back to Registration</a>
            </div>
          </div>

          <script>
            function filterTransactions() {
              var query = document.getElementById('searchFilter').value.toLowerCase().trim();
              var status = document.getElementById('statusFilter').value;
              var rows = document.querySelectorAll('.transaction-row');
              var visibleCount = 0;

              rows.forEach(function(row) {
                var matchesSearch = !query ||
                  row.dataset.name.indexOf(query) !== -1 ||
                  row.dataset.username.indexOf(query) !== -1 ||
                  row.dataset.email.indexOf(query) !== -1 ||
                  row.dataset.userid === query;
                var matchesStatus = !status || row.dataset.status === status;

                if (matchesSearch && matchesStatus) {
                  row.style.display = '';
                  visibleCount++;
                } else {
                  row.style.display = 'none';
                }
              });

              var noResults = document.getElementById('noResults');
              var emptyRow = document.getElementById('emptyRow');
              if (rows.length > 0) {
                noResults.style.display = visibleCount === 0 ? '' : 'none';
              }
              if (emptyRow) {
                emptyRow.style.display = (query || status) ? 'none' : '';
              }
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // ── View Transaction Details ───────────────────────────────────────────────
  router.get('/registration/view/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const transactionId = req.params.id;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT rt.*, u.name as customer_name, u.username as customer_username, u.email as customer_email, r.name as registrar_name
            FROM registration_transactions rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN users r ON rt.registrar_id = r.user_id
            WHERE rt.transaction_id = ?`, [transactionId], (err, transaction) => {
      if (err || !transaction) {
        return res.redirect('/registrar/registration/history');
      }

      const vehicles = safeJsonParse(transaction.vehicles_json);
      const products = safeJsonParse(transaction.products_json);

      const vehicleList = vehicles.map(v => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--divider-color);">
          <span>${v.year ? v.year + ' ' : ''}${v.make} ${v.model}</span>
          <span>$${v.price}</span>
        </div>
      `).join('');

      const productList = products.map(p => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--divider-color);">
          <span>${p.name} x${p.quantity}</span>
          <span>$${(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
        </div>
      `).join('');

      const statusClass = transaction.status === 'complete' ? 'active' : 'inactive';
      const statusText = transaction.status === 'complete' ? 'Completed' : 'Cancelled';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transaction Details - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${user.image_url ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(user.name)}</div>
                <a href="/registrar/profile" class="profile-btn">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            ${registrarNav('registration', chatEnabled)}

            <h3 class="section-title">Transaction #${transaction.transaction_id}</h3>

            <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--card-border);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div>
                  <div style="font-weight:700;font-size:16px;color:var(--text-primary);">${transaction.customer_name}</div>
                  <div style="font-size:13px;color:var(--text-secondary);">@${transaction.customer_username}${transaction.customer_email ? ' · ' + transaction.customer_email : ''}</div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
              </div>
              <div style="font-size:13px;color:var(--text-muted);">
                Processed by ${transaction.registrar_name} on ${transaction.completed_at ? new Date(transaction.completed_at).toLocaleString() : 'N/A'}
              </div>
            </div>

            ${vehicles.length > 0 ? `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--card-border);">
              <h4 style="color:var(--text-primary);margin-bottom:12px;">Vehicles</h4>
              ${vehicleList}
            </div>
            ` : ''}

            ${products.length > 0 ? `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--card-border);">
              <h4 style="color:var(--text-primary);margin-bottom:12px;">Products</h4>
              ${productList}
            </div>
            ` : ''}

            <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--card-border);">
              <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:700;color:var(--success-color);">
                <span>Total</span>
                <span>$${transaction.total_amount || '0.00'}</span>
              </div>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar/registration/history">&larr; Back to History</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  return router;
};
