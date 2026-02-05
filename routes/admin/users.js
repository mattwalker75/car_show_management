// routes/admin/users.js - User management routes for admin
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAdmin, hashPassword } = require('../../middleware/auth');
  const {
    styles,
    adminStyles,
    getBodyTag,
    getAppBgStyles,
    getAdminNav,
    getAvatarContent,
    getInitials,
    adminHeader,
    isChatEnabled
  } = require('./shared');

  // ============================================================
  // Admin Users - User list
  // ============================================================
  router.get('/', requireAdmin, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    db.all('SELECT user_id as id, username, name, email, phone, role, is_active, image_url, created_at FROM users ORDER BY created_at DESC', (err, users) => {
      if (err) {
        users = [];
      }

      const userCards = users.map(u => `
        <div class="user-card" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}" onclick="window.location.href='/admin/view-user/${u.id}'" style="cursor:pointer;">
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
            </div>
            <div class="user-card-badges">
              <span class="role-badge ${u.role}">${u.role}</span>
              <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="user-card-actions" onclick="event.stopPropagation()">
              <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
              ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
            </div>
          </div>
        </div>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Users - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}

            ${getAdminNav('users', isChatEnabled(appConfig, user))}

            <h3 class="section-title">All Users</h3>

            <div style="margin-bottom:16px;">
              <input type="text" id="userSearch" placeholder="Search by name, login ID, email, or phone..." oninput="filterUsers()" style="width:100%;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-primary)'" onblur="this.style.borderColor='var(--card-border)'">
            </div>
            <div id="noResults" style="display:none;text-align:center;color:var(--text-secondary);padding:20px;font-size:14px;">No users match your search.</div>

            <div class="user-cards">
              ${userCards}
            </div>

            <div style="margin-top:20px;text-align:center;">
              <a href="/admin/add-user" class="action-btn edit" style="display:inline-block;padding:12px 24px;font-size:16px;">Add User</a>
            </div>
            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
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
  // View User - Detail page
  // ============================================================
  router.get('/view-user/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const userId = req.params.id;

    db.get('SELECT user_id as id, username, name, email, phone, role, is_active, image_url, created_at FROM users WHERE user_id = ?', [userId], (err, viewUser) => {
      if (err || !viewUser) {
        res.redirect('/admin');
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
          <div class="vehicle-card" onclick="window.location.href='/admin/view-vehicle/${car.car_id}'" style="cursor:pointer;">
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
                <a href="/admin/vendors/${viewUser.id}" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--container-bg);border:1px solid var(--card-border);border-radius:10px;text-decoration:none;color:var(--text-primary);font-weight:600;">
                  🏪 View Vendor Store
                </a>
              </div>` : '';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>View User - Admin Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
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
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}

              ${getAdminNav('users', isChatEnabled(appConfig, user))}

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
                <a href="/admin/edit-user/${viewUser.id}" class="action-btn edit">Edit</a>
                ${viewUser.id !== user.user_id ? `<a href="/admin/delete-user/${viewUser.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
              </div>

              <div class="links" style="margin-top:20px;text-align:center;">
                <a href="/admin">&larr; Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // Add User - Form
  // ============================================================
  router.get('/add-user', requireAdmin, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add User - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        ${getAppBgStyles(appConfig)}
      </head>
      ${getBodyTag(req)}
        <div class="container dashboard-container">
          ${adminHeader(user)}

          ${getAdminNav('', isChatEnabled(appConfig, user))}

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
                <option value="vendor">Vendor</option>
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
          <div class="links" style="margin-top:20px;">
            <a href="/admin">&larr; Back to Users</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // ============================================================
  // Add User - Process form submission
  // ============================================================
  router.post('/add-user', requireAdmin, async (req, res) => {
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
        ${getBodyTag(req)}
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

    const hashedPassword = await hashPassword(password);
    const chatEnabled = ['admin', 'judge', 'registrar', 'vendor'].includes(role) ? 1 : 0;

    db.run('INSERT INTO users (username, name, email, phone, password_hash, role, chat_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, name, email, phone, hashedPassword, role, chatEnabled],
      function(err) {
        if (err) {
          console.error('Error creating user:', err.message);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Add User - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            ${getBodyTag(req)}
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error creating user. Please try again.</div>
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

  // ============================================================
  // Edit User - Form
  // ============================================================
  router.get('/edit-user/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);
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
        ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}

            ${getAdminNav('', isChatEnabled(appConfig, user))}

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
                  <option value="vendor" ${editUser.role === 'vendor' ? 'selected' : ''}>Vendor</option>
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
            <div class="links" style="margin-top:20px;">
              <a href="/admin">&larr; Back to Users</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ============================================================
  // Edit User - Process form submission
  // ============================================================
  router.post('/edit-user/:id', requireAdmin, async (req, res) => {
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
        ${getBodyTag(req)}
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

    // Enable chat for privileged roles
    const privilegedRoles = ['admin', 'judge', 'registrar', 'vendor'];
    const enableChat = privilegedRoles.includes(role);

    if (password) {
      // Update with new password
      const hashedPassword = await hashPassword(password);
      db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ? WHERE user_id = ?',
        [username, name, email, phone, role, is_active, hashedPassword, userId],
        function(err) {
          if (err) {
            console.error('Error updating user (with password change):', err.message);
            res.send(`<div class="error-message">Error updating user. Please try again.</div><a href="/admin">Back</a>`);
          } else {
            if (enableChat) {
              db.run('UPDATE users SET chat_enabled = 1 WHERE user_id = ? AND chat_enabled = 0', [userId], function() {});
            }
            res.redirect('/admin');
          }
        });
    } else {
      // Update without password change
      db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE user_id = ?',
        [username, name, email, phone, role, is_active, userId],
        function(err) {
          if (err) {
            console.error('Error updating user (without password change):', err.message);
            res.send(`<div class="error-message">Error updating user. Please try again.</div><a href="/admin">Back</a>`);
          } else {
            if (enableChat) {
              db.run('UPDATE users SET chat_enabled = 1 WHERE user_id = ? AND chat_enabled = 0', [userId], function() {});
            }
            res.redirect('/admin');
          }
        });
    }
  });

  // ============================================================
  // Delete User
  // ============================================================
  router.get('/delete-user/:id', requireAdmin, (req, res) => {
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

  return router;
};
