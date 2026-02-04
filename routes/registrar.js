// routes/registrar.js - Registrar dashboard, vehicle management, and user management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireRegistrar, hashPassword } = require('../middleware/auth');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getInitials, getAvatarContent, registrarNav, dashboardHeader, getNav } = require('../views/components');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => { const u = req.session && req.session.user; return `<body data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`; };

  // ── Registrar Dashboard ───────────────────────────────────────────────
  router.get('/', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
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
              <a href="/registrar/users">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

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
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get all users (not admins)
    db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role NOT IN (?, ?) ORDER BY name', ['admin', 'registrar'], (err, users) => {
      if (err) {
        users = [];
      }

      const userRows = users.map(u => `
        <tr class="user-row" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}" style="border-bottom:none;">
          <td style="border-bottom:none;">${u.username}</td>
          <td style="border-bottom:none;">${u.name}</td>
          <td style="border-bottom:none;">${u.email}</td>
          <td style="border-bottom:none;">${u.phone || '-'}</td>
          <td style="border-bottom:none;"><span class="role-badge ${u.role}">${u.role}</span></td>
          <td style="border-bottom:none;"><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
        <tr class="user-row-actions" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}">
          <td colspan="6" style="border-top:none;padding-top:0;text-align:center;">
            <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
          </td>
        </tr>
      `).join('');

      // Mobile card view
      const userCards = users.map(u => `
        <div class="user-card" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}">
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users" class="active">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Users & Judges</h3>
            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and judges.</p>

            <div style="margin-bottom:16px;">
              <input type="text" id="userSearch" placeholder="Search by name, login ID, email, or phone..." oninput="filterUsers()" style="width:100%;padding:10px 14px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#e94560'" onblur="this.style.borderColor='#e1e1e1'">
            </div>
            <div id="noResults" style="display:none;text-align:center;color:#666;padding:20px;font-size:14px;">No users match your search.</div>

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
                  </tr>
                </thead>
                <tbody>
                  ${userRows}
                </tbody>
              </table>
            </div>
            <div class="scroll-hint"></div>

            <div class="links" style="margin-top:20px;">
              <a href="/registrar">&larr; Back to Dashboard</a>
            </div>
          </div>
          <script>
            function filterUsers() {
              var query = document.getElementById('userSearch').value.toLowerCase().trim();
              var cards = document.querySelectorAll('.user-card');
              var rows = document.querySelectorAll('.user-row');
              var actionRows = document.querySelectorAll('.user-row-actions');
              var visibleCount = 0;

              cards.forEach(function(card) {
                var match = !query || card.dataset.username.indexOf(query) !== -1 || card.dataset.name.indexOf(query) !== -1 || card.dataset.email.indexOf(query) !== -1 || card.dataset.phone.indexOf(query) !== -1;
                card.style.display = match ? '' : 'none';
                if (match) visibleCount++;
              });

              rows.forEach(function(row, i) {
                var match = !query || row.dataset.username.indexOf(query) !== -1 || row.dataset.name.indexOf(query) !== -1 || row.dataset.email.indexOf(query) !== -1 || row.dataset.phone.indexOf(query) !== -1;
                row.style.display = match ? '' : 'none';
                if (actionRows[i]) actionRows[i].style.display = match ? '' : 'none';
              });

              document.getElementById('noResults').style.display = (query && visibleCount === 0) ? '' : 'none';
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // ── Reset Password (GET form) ─────────────────────────────────────────
  router.get('/reset-password/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
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
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
        <div class="vehicle-card ${car.is_active ? '' : 'pending'}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-status="${car.is_active ? 'active' : 'pending'}" data-voterid="${car.voter_id || ''}" data-price="${price.toFixed(2)}">
          <div class="vehicle-select">
            <input type="checkbox" class="vehicle-checkbox" data-price="${price.toFixed(2)}" data-carid="${car.car_id}" onchange="updateSelectionTotal()">
          </div>
          <a href="/registrar/view-vehicle/${car.car_id}" class="vehicle-image" style="cursor:pointer;display:block;text-decoration:none;">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </a>
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
          <div class="vehicle-actions">
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
            .type-badge {
              background: #3498db;
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
              accent-color: #3498db;
            }
            .vehicle-card.selected {
              border-color: #3498db !important;
              background: #eaf6ff !important;
            }
            .price-badge {
              background: #27ae60;
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
              .vehicle-select {
                flex-shrink: 0;
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles" class="active">Vehicles</a>
              <a href="/registrar/users">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
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

            <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="searchFilter" placeholder="Search by name, email, make, model, or voter ID..." oninput="filterVehicles()" style="flex:1;min-width:200px;font-size:16px;">
              <select id="statusFilter" onchange="filterVehicles()" style="min-width:140px;">
                <option value="">All Statuses</option>
                <option value="pending">Pending Payment</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div id="noResults" style="display:none;color:#666;text-align:center;padding:20px;">No vehicles match your filter.</div>

            <div id="vehicleList">
              ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
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
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
            .detail-card {
              background: white;
              border-radius: 12px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.08);
              margin-bottom: 20px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #f0f0f0;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #555;
            }
            .detail-value {
              color: #333;
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Vehicle Details</h3>

            <div class="vehicle-preview">
              ${car.image_url
                ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}"></div>`
                : `<div class="vehicle-preview-placeholder">🚗</div>`
              }
              <div class="vehicle-preview-info">
                <h4>${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h4>
                <p><strong>Type:</strong> ${car.vehicle_name || 'N/A'}</p>
                <p><strong>Class:</strong> ${car.class_name || 'N/A'}</p>
                ${car.description ? `<p><strong>Description:</strong> ${car.description}</p>` : ''}
              </div>
            </div>

            <div class="detail-card">
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value"><span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending Payment'}</span></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Voter ID</span>
                <span class="detail-value">${car.voter_id ? '#' + car.voter_id : 'Not assigned'}</span>
              </div>
            </div>

            <div class="owner-details">
              <h4>Owner Information</h4>
              <p><strong>Name:</strong> ${car.owner_name || 'Unknown'}</p>
              <p><strong>Username:</strong> @${car.owner_username || 'N/A'}</p>
              <p><strong>Email:</strong> ${car.owner_email || 'N/A'}</p>
              <p><strong>Phone:</strong> ${car.owner_phone || 'N/A'}</p>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <a href="/registrar/vehicles" class="action-btn" style="background:#6c757d;">Back to Vehicles</a>
              <a href="/registrar/edit-vehicle/${car.car_id}" class="action-btn edit">${car.is_active ? 'Edit' : 'Activate'}</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ── Edit Vehicle (GET form) ───────────────────────────────────────────
  router.get('/edit-vehicle/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
              background: #e1e1e1;
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
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Registrar</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users">Users</a>
              <a href="/registrar/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

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
                    <button type="button" onclick="document.getElementById('voterIdInput').value='${nextVoterId}'" style="white-space:nowrap;background:#3498db;color:#000;padding:10px 16px;">Auto-Assign (#${nextVoterId})</button>
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

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];

      const vendorCards = vendors.length > 0 ? vendors.map(v => {
        const addressParts = [v.business_street, v.business_city, v.business_state].filter(Boolean);
        const addressLine = addressParts.length > 0
          ? (v.business_street ? v.business_street + (v.business_city || v.business_state ? ', ' : '') : '')
            + (v.business_city ? v.business_city + (v.business_state ? ', ' : '') : '')
            + (v.business_state || '')
            + (v.business_zip ? ' ' + v.business_zip : '')
          : '';

        return `
          <a href="/registrar/vendors/${v.user_id}" class="vendor-browse-card">
            <div class="vendor-browse-image">
              ${v.image_url
                ? `<img src="${v.image_url}" alt="${v.business_name || v.vendor_name}">`
                : `<div class="vendor-placeholder">🏪</div>`
              }
            </div>
            <div class="vendor-browse-info">
              <div class="vendor-browse-name">${v.business_name || v.vendor_name}</div>
              ${v.business_email ? `<div class="vendor-browse-detail">${v.business_email}</div>` : ''}
              ${v.business_phone ? `<div class="vendor-browse-detail">${v.business_phone}</div>` : ''}
              ${addressLine ? `<div class="vendor-browse-detail">${addressLine}</div>` : ''}
              ${v.business_description ? `<div class="vendor-browse-desc">${v.business_description}</div>` : ''}
            </div>
          </a>`;
      }).join('') : '<p style="color: #666; text-align: center; padding: 20px;">No vendors have registered yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vendors - Registrar Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
          <style>
            .vendor-browse-card {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 12px;
              margin-bottom: 12px;
              border: 1px solid #e1e1e1;
              display: flex;
              flex-direction: row;
              gap: 12px;
              align-items: center;
              text-decoration: none;
              color: inherit;
              transition: all 0.2s ease;
            }
            .vendor-browse-card:active {
              background: #eef;
            }
            .vendor-browse-image {
              width: 80px;
              height: 80px;
              border-radius: 8px;
              overflow: hidden;
              background: #e1e1e1;
              flex-shrink: 0;
            }
            .vendor-browse-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .vendor-placeholder {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
            .vendor-browse-info {
              flex: 1;
              min-width: 0;
            }
            .vendor-browse-name {
              font-size: 16px;
              font-weight: 700;
              color: #1a1a2e;
              margin-bottom: 4px;
            }
            .vendor-browse-detail {
              font-size: 13px;
              color: #555;
              line-height: 1.4;
            }
            .vendor-browse-desc {
              font-size: 12px;
              color: #888;
              font-style: italic;
              margin-top: 4px;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            @media (min-width: 768px) {
              .vendor-browse-card {
                padding: 16px;
              }
              .vendor-browse-card:hover {
                border-color: #e94560;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
              }
              .vendor-browse-image {
                width: 100px;
                height: 100px;
              }
              .vendor-browse-name {
                font-size: 18px;
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            ${dashboardHeader('registrar', user, 'Registrar Dashboard')}

            ${getNav('registrar', 'vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}
          </div>
        </body>
        </html>
      `);
    });
  });

  // View vendor detail - products & services and booth info
  router.get('/vendors/:id', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;

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

        const addressParts = [business.business_street, business.business_city, business.business_state].filter(Boolean);
        const addressLine = addressParts.length > 0
          ? (business.business_street ? business.business_street + (business.business_city || business.business_state ? ', ' : '') : '')
            + (business.business_city ? business.business_city + (business.business_state ? ', ' : '') : '')
            + (business.business_state || '')
            + (business.business_zip ? ' ' + business.business_zip : '')
          : '';

        const productsHtml = products.length > 0 ? products.map(p => {
          const soldOut = !p.available;
          return `
          <a href="/registrar/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link">
          <div class="product-card${soldOut ? ' sold-out' : ''}">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
            <div class="product-info">
              <h5>${p.product_name}${soldOut ? ' - SOLD OUT' : ''}</h5>
              ${p.description ? `<p>${p.description}</p>` : ''}
              ${p.price ? (p.discount_price
                ? `<p style="font-weight:600;color:#e94560;"><span style="text-decoration:line-through;color:#999;">$${p.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${p.discount_price}</span></p>`
                : `<p style="font-weight:600;color:#e94560;${soldOut ? 'text-decoration:line-through;' : ''}">$${p.price}</p>`
              ) : ''}
            </div>
          </div>
          </a>`;
        }).join('') : '<p style="color:#888;font-style:italic;">No products or services listed yet.</p>';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${business.business_name || business.vendor_name} - Registrar Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
            <style>
              .vendor-detail-header {
                display: flex;
                gap: 16px;
                align-items: flex-start;
                background: #f8f9fa;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
                border: 1px solid #e1e1e1;
              }
              .vendor-detail-image {
                width: 100px;
                height: 100px;
                border-radius: 8px;
                overflow: hidden;
                background: #e1e1e1;
                flex-shrink: 0;
              }
              .vendor-detail-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .vendor-detail-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              }
              .vendor-detail-info {
                flex: 1;
                min-width: 0;
              }
              .vendor-detail-info h3 {
                margin: 0 0 8px 0;
                font-size: 20px;
                color: #1a1a2e;
              }
              .vendor-detail-info p {
                margin: 2px 0;
                font-size: 14px;
                color: #555;
              }
              .vendor-section {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                border: 1px solid #e1e1e1;
              }
              .vendor-section h4 {
                margin: 0 0 12px 0;
                font-size: 16px;
                color: #1a1a2e;
                border-bottom: 2px solid #e94560;
                padding-bottom: 8px;
              }
              .product-card {
                background: white;
                border: 1px solid #e1e1e1;
                border-radius: 10px;
                padding: 14px;
                margin-bottom: 10px;
                display: flex;
                gap: 14px;
                align-items: flex-start;
              }
              .product-card img {
                width: 80px;
                height: 60px;
                object-fit: cover;
                border-radius: 6px;
                border: 1px solid #e1e1e1;
                flex-shrink: 0;
              }
              .product-info {
                flex: 1;
              }
              .product-info h5 {
                margin: 0 0 4px 0;
                font-size: 15px;
                color: #1a1a2e;
              }
              .product-info p {
                margin: 0;
                font-size: 13px;
                color: #666;
              }
              .booth-info {
                font-size: 16px;
                color: #333;
                font-weight: 600;
              }
              .products-scroll-wrapper {
                position: relative;
                display: flex;
                max-height: 290px;
              }
              .products-scroll {
                flex: 1;
                max-height: 290px;
                overflow-y: scroll;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
              }
              .products-scroll::-webkit-scrollbar { display: none; }
              .custom-scrollbar-track {
                width: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                margin-left: 6px;
                position: relative;
                flex-shrink: 0;
              }
              .custom-scrollbar-thumb {
                width: 8px;
                background: #888;
                border-radius: 4px;
                position: absolute;
                top: 0;
                min-height: 30px;
                cursor: pointer;
              }
              .product-card-link { text-decoration: none; color: inherit; display: block; }
              .product-card-link:active .product-card { background: #eef; }
              .product-card.sold-out { opacity: 0.7; }
              .product-card.sold-out h5 { color: #e74c3c; }
              @media (min-width: 768px) {
                .vendor-detail-image {
                  width: 120px;
                  height: 120px;
                }
                .vendor-detail-info h3 {
                  font-size: 22px;
                }
                .product-card-link:hover .product-card { border-color: #e94560; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              ${dashboardHeader('registrar', user, 'Registrar Dashboard')}

              ${getNav('registrar', 'vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

              <div class="vendor-detail-header">
                <div class="vendor-detail-image">
                  ${business.image_url
                    ? `<img src="${business.image_url}" alt="${business.business_name || business.vendor_name}">`
                    : `<div class="vendor-detail-placeholder">🏪</div>`
                  }
                </div>
                <div class="vendor-detail-info">
                  <h3>${business.business_name || business.vendor_name}</h3>
                  ${business.business_email ? `<p>${business.business_email}</p>` : ''}
                  ${business.business_phone ? `<p>${business.business_phone}</p>` : ''}
                  ${addressLine ? `<p>${addressLine}</p>` : ''}
                  ${business.business_description ? `<p style="margin-top:6px;color:#888;font-style:italic;">${business.business_description}</p>` : ''}
                </div>
              </div>

              <div class="vendor-section">
                <h4>Booth Information</h4>
                ${business.booth_location
                  ? `<p class="booth-info">${business.booth_location}</p>`
                  : `<p style="color:#888;font-style:italic;">Booth location not set yet.</p>`
                }
              </div>

              <div class="vendor-section">
                <h4>Products &amp; Services</h4>
                ${products.length > 3 ? `
                  <div class="products-scroll-wrapper">
                    <div class="products-scroll" id="productsScroll">${productsHtml}</div>
                    <div class="custom-scrollbar-track" id="scrollTrack">
                      <div class="custom-scrollbar-thumb" id="scrollThumb"></div>
                    </div>
                  </div>
                  <script>
                  (function(){
                    var el=document.getElementById('productsScroll'),
                        track=document.getElementById('scrollTrack'),
                        thumb=document.getElementById('scrollThumb'),
                        dragging=false,dragY=0,dragTop=0;
                    function update(){
                      var ratio=el.clientHeight/el.scrollHeight,
                          thumbH=Math.max(30,track.clientHeight*ratio),
                          maxTop=track.clientHeight-thumbH,
                          scrollRatio=el.scrollTop/(el.scrollHeight-el.clientHeight);
                      thumb.style.height=thumbH+'px';
                      thumb.style.top=(maxTop*scrollRatio)+'px';
                    }
                    el.addEventListener('scroll',update);
                    update();
                    thumb.addEventListener('mousedown',function(e){dragging=true;dragY=e.clientY;dragTop=parseInt(thumb.style.top)||0;e.preventDefault();});
                    thumb.addEventListener('touchstart',function(e){dragging=true;dragY=e.touches[0].clientY;dragTop=parseInt(thumb.style.top)||0;e.preventDefault();},{passive:false});
                    document.addEventListener('mousemove',function(e){if(!dragging)return;move(e.clientY);});
                    document.addEventListener('touchmove',function(e){if(!dragging)return;move(e.touches[0].clientY);},{passive:false});
                    document.addEventListener('mouseup',function(){dragging=false;});
                    document.addEventListener('touchend',function(){dragging=false;});
                    function move(y){
                      var ratio=el.clientHeight/el.scrollHeight,
                          thumbH=Math.max(30,track.clientHeight*ratio),
                          maxTop=track.clientHeight-thumbH,
                          newTop=Math.min(maxTop,Math.max(0,dragTop+(y-dragY)));
                      thumb.style.top=newTop+'px';
                      el.scrollTop=(newTop/maxTop)*(el.scrollHeight-el.clientHeight);
                    }
                    track.addEventListener('click',function(e){
                      if(e.target===thumb)return;
                      var rect=track.getBoundingClientRect(),
                          ratio=el.clientHeight/el.scrollHeight,
                          thumbH=Math.max(30,track.clientHeight*ratio),
                          clickPos=e.clientY-rect.top-thumbH/2,
                          maxTop=track.clientHeight-thumbH;
                      el.scrollTop=(Math.max(0,Math.min(maxTop,clickPos))/maxTop)*(el.scrollHeight-el.clientHeight);
                    });
                  })();
                  </script>
                ` : productsHtml}
              </div>

              <div class="links" style="margin-top:20px;">
                <a href="/registrar/vendors">&larr; Back to Vendors</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/registrar/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/registrar/vendors/${vendorUserId}`);

        const soldOut = !product.available;
        const businessName = business.business_name || business.vendor_name;

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${product.product_name} - ${businessName} - ${appConfig.appTitle || 'Car Show Manager'}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${appBgStyles()}
            <style>
              .product-detail-image { width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; margin: 0 auto 20px; border: 2px solid #e1e1e1; }
              .product-detail-image img { width: 100%; display: block; }
              .product-detail-name { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
              .product-detail-name.sold-out { color: #e74c3c; }
              .product-detail-vendor { font-size: 14px; color: #888; margin-bottom: 16px; }
              .product-detail-desc { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px; }
              .product-detail-price { font-size: 20px; font-weight: 700; color: #e94560; margin-bottom: 8px; }
              .product-detail-price.sold-out { text-decoration: line-through; }
              .product-detail-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
              .product-detail-status.available { background: #e8f5e9; color: #27ae60; }
              .product-detail-status.sold-out { background: #fde8e8; color: #e74c3c; }
              @media (min-width: 768px) {
                .product-detail-name { font-size: 26px; }
                .product-detail-price { font-size: 24px; }
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              ${dashboardHeader('registrar', user, 'Registrar Dashboard')}

              ${getNav('registrar', 'vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

              ${product.image_url ? `<div class="product-detail-image"><img src="${product.image_url}" alt="${product.product_name}"></div>` : ''}

              <div class="product-detail-name${soldOut ? ' sold-out' : ''}">${product.product_name}${soldOut ? ' - SOLD OUT' : ''}</div>
              <div class="product-detail-vendor">by ${businessName}</div>

              <span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>

              ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
              ${product.price ? (product.discount_price
                ? `<div class="product-detail-price"><span style="text-decoration:line-through;color:#999;font-size:0.8em;">$${product.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${product.discount_price}</span></div>`
                : `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>`
              ) : ''}

              <div class="links" style="margin-top:20px;">
                <a href="/registrar/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  return router;
};
