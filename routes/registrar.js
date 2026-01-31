// routes/registrar.js - Registrar dashboard, vehicle management, and user management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireRegistrar, hashPassword } = require('../middleware/auth');
  const { errorPage, successPage } = require('../views/layout');
  const { getAvatarContent, registrarNav } = require('../views/components');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script>';

  // ── Registrar Dashboard ───────────────────────────────────────────────
  router.get('/', requireRegistrar, (req, res) => {
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
        </head>
        <body>
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
              <a href="/registrar/users">View Users</a>
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users" class="active">View Users</a>
                <a href="/user/vote">Vote Here!</a>
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

  // ── Reset Password (GET form) ─────────────────────────────────────────
  router.get('/reset-password/:id', requireRegistrar, (req, res) => {
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users">View Users</a>
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
  router.post('/reset-password/:id', requireRegistrar, (req, res) => {
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
          console.error('Error resetting password:', err.message);
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

  // ── Vehicle List with Filters ─────────────────────────────────────────
  router.get('/vehicles', requireRegistrar, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get all vehicles with owner info and class names
    db.all(`SELECT c.car_id, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active,
            u.name as owner_name, u.username as owner_username, u.email as owner_email,
            cl.class_name, v.vehicle_name
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

      const vehicleCards = cars.map(car => `
        <div class="vehicle-card ${car.is_active ? '' : 'pending'}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-status="${car.is_active ? 'active' : 'pending'}" data-voterid="${car.voter_id || ''}">
          <a href="/registrar/view-vehicle/${car.car_id}" class="vehicle-image" style="cursor:pointer;display:block;text-decoration:none;">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </a>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.make} ${car.model}</div>
            <div class="vehicle-meta">${car.owner_name || 'Unknown'} &mdash; ${car.owner_email || 'N/A'}</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles" class="active">Vehicles</a>
              <a href="/registrar/users">View Users</a>
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
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
        <body>
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
              <a href="/registrar/users">View Users</a>
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Vehicle Details</h3>

            <div class="vehicle-preview">
              ${car.image_url
                ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
                : `<div class="vehicle-preview-placeholder">🚗</div>`
              }
              <div class="vehicle-preview-info">
                <h4>${car.year || ''} ${car.make} ${car.model}</h4>
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
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/registrar">Dashboard</a>
              <a href="/registrar/vehicles">Vehicles</a>
              <a href="/registrar/users">View Users</a>
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">${car.is_active ? 'Edit' : 'Activate'} Vehicle</h3>

            <div class="vehicle-preview">
              ${car.image_url
                ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
                : `<div class="vehicle-preview-placeholder">🚗</div>`
              }
              <div class="vehicle-preview-info">
                <h4>${car.make} ${car.model}</h4>
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
                    <input type="text" name="voter_id" id="voterIdInput" value="${car.voter_id || ''}" placeholder="Assign a voter number" style="flex:1;">
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
            <body>
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
            <body>
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
          res.redirect('/registrar/vehicles');
        }
      });
    }
  });

  return router;
};
