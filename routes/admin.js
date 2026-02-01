// routes/admin.js - Admin dashboard, user management, and vehicle management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAdmin, hashPassword } = require('../middleware/auth');
  const { handleVehiclePhotoUpload } = require('../helpers/imageUpload');
  const { errorPage, successPage } = require('../views/layout');
  const { getAvatarContent, adminNav } = require('../views/components');
  const sharp = require('sharp');
  const crypto = require('crypto');
  const path = require('path');
  const fs = require('fs');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script>';

  // ============================================================
  // Admin Dashboard - Stats overview
  // ============================================================
  router.get('/dashboard', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.all(`SELECT role, COUNT(*) as count FROM users WHERE is_active = 1 GROUP BY role`, (err, roleCounts) => {
      const stats = { admin: 0, judge: 0, registrar: 0, user: 0 };
      if (!err && roleCounts) {
        roleCounts.forEach(r => { stats[r.role] = r.count; });
      }

      db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM cars`, (err, carStats) => {
        if (err) carStats = { total: 0, active: 0 };
        const totalVehicles = carStats.total || 0;
        const activeVehicles = carStats.active || 0;
        const inactiveVehicles = totalVehicles - activeVehicles;

        const judgeStatus = appConfig.judgeVotingStatus || 'Close';
        const specialtyStatus = appConfig.specialtyVotingStatus || 'Close';

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
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="welcome-card">
                <h2>Welcome, ${user.name}!</h2>
                <p>Manage users, judges, and system settings.</p>
              </div>

              <div class="admin-nav">
                <a href="/admin/dashboard" class="active">Dashboard</a>
                <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/user/vote">Vote Here!</a>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number">${stats.user}</div>
                  <div class="stat-label">Users</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${stats.judge}</div>
                  <div class="stat-label">Judges</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${stats.registrar}</div>
                  <div class="stat-label">Registrars</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${activeVehicles}</div>
                  <div class="stat-label">Active Vehicles</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${inactiveVehicles}</div>
                  <div class="stat-label">Pending Vehicles</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${judgeStatus}</div>
                  <div class="stat-label">Judge Voting</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${specialtyStatus}</div>
                  <div class="stat-label">Specialty Voting</div>
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ============================================================
  // Admin Users - User list
  // ============================================================
  router.get('/', requireAdmin, (req, res) => {
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
        <tr class="user-row" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}" style="border-bottom:none;">
          <td style="border-bottom:none;">${u.username}</td>
          <td style="border-bottom:none;">${u.name}</td>
          <td style="border-bottom:none;">${u.email}</td>
          <td style="border-bottom:none;"><span class="role-badge ${u.role}">${u.role}</span></td>
          <td style="border-bottom:none;"><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
        <tr class="user-row-actions" data-username="${(u.username || '').toLowerCase()}" data-name="${(u.name || '').toLowerCase()}" data-email="${(u.email || '').toLowerCase()}" data-phone="${(u.phone || '').toLowerCase()}">
          <td colspan="5" style="border-top:none;padding-top:0;text-align:center;">
            <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
            ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
          </td>
        </tr>
      `).join('');

      // Mobile card view for small screens
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
          <title>Users - Admin Dashboard</title>
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin" class="active">Users</a>
              <a href="/admin/vehicles">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports">Reports</a>
              <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">All Users</h3>

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

  // ============================================================
  // Add User - Form
  // ============================================================
  router.get('/add-user', requireAdmin, (req, res) => {
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
              <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/dashboard">Dashboard</a>
            <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
            <a href="/admin/reports">Reports</a>
                <a href="/user/vote">Vote Here!</a>
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
  router.post('/add-user', requireAdmin, (req, res) => {
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
          console.error('Error creating user:', err.message);
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports">Reports</a>
                <a href="/user/vote">Vote Here!</a>
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
  router.post('/edit-user/:id', requireAdmin, (req, res) => {
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
            console.error('Error updating user (with password change):', err.message);
            res.send(`<div class="error-message">Error updating user. Please try again.</div><a href="/admin">Back</a>`);
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
            console.error('Error updating user (without password change):', err.message);
            res.send(`<div class="error-message">Error updating user. Please try again.</div><a href="/admin">Back</a>`);
          } else {
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

  // ============================================================
  // Vehicle List - All vehicles with filter/search
  // ============================================================
  router.get('/vehicles', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get active vehicles with owner info and class names
    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active, c.created_at,
            u.name as owner_name, u.username as owner_username, u.email as owner_email,
            cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.is_active = 1
            ORDER BY cl.class_name, c.make, c.model`, (err, activeCars) => {
      if (err) activeCars = [];

      // Get inactive vehicles
      db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active, c.created_at,
              u.name as owner_name, u.username as owner_username, u.email as owner_email,
              cl.class_name, v.vehicle_name
              FROM cars c
              LEFT JOIN users u ON c.user_id = u.user_id
              LEFT JOIN classes cl ON c.class_id = cl.class_id
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              WHERE c.is_active = 0
              ORDER BY c.make, c.model`, (err, inactiveCars) => {
        if (err) inactiveCars = [];

      const makeCard = (car) => `
        <div class="vehicle-card" data-year="${(car.year || '').toString().toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-username="${(car.owner_username || '').toLowerCase()}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-voterid="${car.voter_id || ''}" data-status="active">
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</div>
            <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
            </div>
            ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
          </div>
          <div class="vehicle-actions">
            <a href="/admin/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
            <a href="/admin/delete-vehicle/${car.car_id}" class="action-btn delete" onclick="return confirm('Are you sure you want to permanently delete this vehicle?')">Delete</a>
          </div>
        </div>
      `;

      // Build sorted voter ID list for dropdown
      const allCars = [...activeCars, ...inactiveCars];
      const voterIds = allCars.map(c => c.voter_id).filter(Boolean).sort((a, b) => a - b);

      const activeVehicleCards = activeCars.map(makeCard).join('');

      const inactiveVehicleCards = inactiveCars.map(car => `
        <div class="vehicle-card" data-year="${(car.year || '').toString().toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-username="${(car.owner_username || '').toLowerCase()}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-voterid="${car.voter_id || ''}" data-status="pending" style="opacity: 0.7; border-color: #ffc107;">
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</div>
            <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
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
              margin-bottom: 8px;
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
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles" class="active">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports">Reports</a>
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">All Vehicles (${activeCars.length + inactiveCars.length})</h3>

            <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="vehicleSearch" placeholder="Search by year, make, model, owner, or email..." oninput="filterVehicles()" style="flex:1;min-width:200px;padding:10px 14px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#e94560'" onblur="this.style.borderColor='#e1e1e1'">
              <select id="statusFilter" onchange="filterVehicles()" style="min-width:140px;padding:10px 14px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
                <option value="">All Statuses</option>
                <option value="pending">Pending Payment</option>
                <option value="active">Active</option>
              </select>
              <select id="voterIdFilter" onchange="filterVehicles()" style="min-width:140px;padding:10px 14px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
                <option value="">All Voter IDs</option>
                ${voterIds.map(id => `<option value="${id}">#${id}</option>`).join('')}
              </select>
            </div>
            <div id="noResults" style="display:none;text-align:center;color:#666;padding:20px;font-size:14px;">No vehicles match your search.</div>

            <div id="activeSection">
              <h3 class="section-title">Active Vehicles (<span id="activeCount">${activeCars.length}</span>)</h3>
              <div id="activeVehicles">
                ${activeCars.length > 0 ? activeVehicleCards : '<p class="no-vehicles-msg" style="color: #666; text-align: center; padding: 20px;">No active vehicles.</p>'}
              </div>
            </div>

            <div id="inactiveSection">
              <h3 class="section-title" style="margin-top:30px;">Inactive Vehicles - Awaiting Registration (<span id="inactiveCount">${inactiveCars.length}</span>)</h3>
              <p style="color:#856404;font-size:13px;margin-bottom:15px;">These vehicles are waiting to be activated by the registrar.</p>
              <div id="inactiveVehicles">
                ${inactiveCars.length > 0 ? inactiveVehicleCards : '<p class="no-vehicles-msg" style="color: #666; text-align: center; padding: 20px;">No inactive vehicles.</p>'}
              </div>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
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
  // Edit Vehicle - Form
  // ============================================================
  router.get('/edit-vehicle/:id', requireAdmin, (req, res) => {
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

      // Get active vehicles and classes from database
      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];

        db.all(`SELECT c.class_id, c.class_name, c.vehicle_id, v.vehicle_name
                FROM classes c
                JOIN vehicles v ON c.vehicle_id = v.vehicle_id
                WHERE c.is_active = 1 AND v.is_active = 1
                ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
          if (err) classes = [];

          const vehicleOptionsHtml = vehicleTypes.map(v =>
            `<option value="${v.vehicle_id}" ${car.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
          ).join('');

          // Filter classes for the current vehicle type
          const currentClasses = classes.filter(c => c.vehicle_id == car.vehicle_id);
          const classOptionsHtml = currentClasses.map(c =>
            `<option value="${c.class_id}" ${car.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
          ).join('');

          const classesJson = JSON.stringify(classes);

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
                    <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/admin/dashboard">Dashboard</a>
                  <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                  <a href="/admin">Users</a>
                  <a href="/admin/vehicles">Vehicles</a>
                  <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                  <a href="/admin/reports">Reports</a>
                  <a href="/user/vote">Vote Here!</a>
                </div>

                <h3 class="section-title">Edit Vehicle: ${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h3>

                <div class="owner-info">
                  <strong>Owner:</strong> ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})
                </div>

                <form method="POST" action="/admin/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
                  <div class="profile-card">
                    <div class="form-group">
                      <label>Year (Optional)</label>
                      <input type="text" name="year" inputmode="numeric" maxlength="4" placeholder="e.g., 1969" value="${car.year || ''}" style="font-size:16px;width:120px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                    </div>
                    <div class="form-group">
                      <label>Make *</label>
                      <input type="text" name="make" required value="${car.make}">
                    </div>
                    <div class="form-group">
                      <label>Model *</label>
                      <input type="text" name="model" required value="${car.model}">
                    </div>
                    <div class="form-group">
                      <label>Vehicle Type *</label>
                      <select name="vehicle_id" id="vehicleType" required onchange="updateClasses()">
                        <option value="">Select vehicle type...</option>
                        ${vehicleOptionsHtml}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Class *</label>
                      <select name="class_id" id="classSelect" required>
                        <option value="">Select a class...</option>
                        ${classOptionsHtml}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Voter ID</label>
                      <input type="text" name="voter_id" value="${car.voter_id || ''}" placeholder="Assigned voter number" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
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
                      <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin:10px auto 0;border-radius:8px;border:2px solid #e1e1e1;">
                    </div>
                    <button type="submit">Update Vehicle</button>
                  </div>
                </form>

                <script>
                  const allClasses = ${classesJson};

                  function updateClasses() {
                    const vehicleId = document.getElementById('vehicleType').value;
                    const classSelect = document.getElementById('classSelect');
                    classSelect.innerHTML = '<option value="">Select a class...</option>';

                    if (vehicleId) {
                      const filteredClasses = allClasses.filter(c => c.vehicle_id == vehicleId);
                      filteredClasses.forEach(c => {
                        const option = document.createElement('option');
                        option.value = c.class_id;
                        option.textContent = c.class_name;
                        classSelect.appendChild(option);
                      });
                    }
                  }

                  function updateFileName(input) {
                    const fileName = document.getElementById('fileName');
                    const wrapper = document.getElementById('fileWrapper');
                    const preview = document.getElementById('imagePreview');
                    if (input.files && input.files[0]) {
                      fileName.textContent = 'Selected: ' + input.files[0].name;
                      wrapper.classList.add('has-file');
                      const reader = new FileReader();
                      reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                      preview.style.marginLeft = 'auto';
                      preview.style.marginRight = 'auto';
                      };
                      reader.readAsDataURL(input.files[0]);
                    } else {
                      fileName.textContent = '';
                      wrapper.classList.remove('has-file');
                      preview.style.display = 'none';
                      preview.src = '';
                    }
                  }
                </script>
              </div>
            </body>
            </html>
          `);
        });
      });
    });
  });

  // ============================================================
  // Edit Vehicle - Process form submission with image upload
  // ============================================================
  router.post('/edit-vehicle/:id', requireAdmin, upload.single('vehicle_photo'), async (req, res) => {
    const carId = req.params.id;
    const { year, make, model, vehicle_id, class_id, voter_id, is_active, description } = req.body;

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
          const filepath = path.join(__dirname, '..', 'images', 'user_uploads', 'cars', filename);
          imageUrl = `/images/user_uploads/cars/${filename}`;

          await sharp(req.file.buffer)
            .rotate()
            .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(filepath);

          if (car.image_url) {
            const oldPath = path.join(__dirname, '..', car.image_url);
            fs.unlink(oldPath, () => {});
          }
        } catch (error) {
          console.error('Error processing image:', error.message);
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
                <div class="error-message">Error processing image. Please try a different file.</div>
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

      // Check if voter_id is unique (if provided)
      const performUpdate = () => {
        db.run('UPDATE cars SET year = ?, make = ?, model = ?, vehicle_id = ?, class_id = ?, voter_id = ?, is_active = ?, description = ?, image_url = ? WHERE car_id = ?',
          [year || null, make, model, vehicle_id, class_id, voter_id || null, is_active, description || null, imageUrl, carId],
          function(err) {
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
      };

      if (voter_id && voter_id.trim() !== '') {
        db.get('SELECT car_id FROM cars WHERE voter_id = ? AND car_id != ?', [voter_id, carId], (checkErr, existingCar) => {
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
                    <a href="/admin/edit-vehicle/${carId}">Try Again</a>
                  </div>
                </div>
              </body>
              </html>
            `);
            return;
          }
          performUpdate();
        });
      } else {
        performUpdate();
      }
    });
  });

  // ============================================================
  // Delete Vehicle
  // ============================================================
  router.get('/delete-vehicle/:id', requireAdmin, (req, res) => {
    const carId = req.params.id;

    db.get('SELECT car_id, image_url FROM cars WHERE car_id = ?', [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/admin/vehicles');
        return;
      }

      db.run('DELETE FROM cars WHERE car_id = ?', [carId], function(err) {
        if (!err && car.image_url) {
          const imagePath = path.join(__dirname, '..', car.image_url);
          fs.unlink(imagePath, () => {});
        }
        res.redirect('/admin/vehicles');
      });
    });
  });

  return router;
};
