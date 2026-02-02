// routes/admin.js - Admin dashboard, user management, and vehicle management routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAdmin, hashPassword } = require('../middleware/auth');
  const { handleVehiclePhotoUpload } = require('../helpers/imageUpload');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getInitials, getAvatarContent, adminNav } = require('../views/components');
  const sharp = require('sharp');
  const crypto = require('crypto');
  const path = require('path');
  const fs = require('fs');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => { const u = req.session && req.session.user; return `<body data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`; };

  // ============================================================
  // Admin Dashboard - Stats overview
  // ============================================================
  router.get('/dashboard', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
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
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
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
              <a href="/admin/vendors">Vendors</a>
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
      </head>
      ${bodyTag(req)}
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
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
        ${bodyTag(req)}
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
            ${bodyTag(req)}
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
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
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
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
        ${bodyTag(req)}
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
      const hashedPassword = hashPassword(password);
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

  // ============================================================
  // Vehicle List - All vehicles with filter/search
  // ============================================================
  router.get('/vehicles', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
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
        ${bodyTag(req)}
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
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
    const initials = getInitials(user.name);
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
        ${appBgStyles()}
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
            ${bodyTag(req)}
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
                  <a href="/admin/vendors">Vendors</a>
                  ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
            ${bodyTag(req)}
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
                ${bodyTag(req)}
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
              // If vehicle was activated, enable chat for the car owner
              if (String(is_active) === '1') {
                db.run('UPDATE users SET chat_enabled = 1 WHERE user_id = (SELECT user_id FROM cars WHERE car_id = ?) AND chat_enabled = 0', [carId], function() {});
              }
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
              ${bodyTag(req)}
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

  // ============================================================
  // ADMIN VENDOR MANAGEMENT ROUTES
  // ============================================================

  // Shared vendor page styles (same as vendor.js browse styles)
  const vendorStyles = `
    <style>
      .vendor-section {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        border: 1px solid #e1e1e1;
      }
      .vendor-section h4 {
        color: #1a1a2e;
        margin-bottom: 12px;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .vendor-detail {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .vendor-detail-label {
        font-weight: 600;
        color: #555;
        min-width: 100px;
      }
      .vendor-detail-value {
        color: #333;
      }
      .vendor-empty {
        color: #999;
        font-style: italic;
        font-size: 13px;
        padding: 10px 0;
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
      .product-info { flex: 1; }
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
      .product-price {
        font-weight: 600;
        color: #27ae60;
        font-size: 14px;
      }
      .product-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
        flex-wrap: wrap;
      }
      .btn-sm {
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        text-decoration: none;
        display: inline-block;
      }
      .btn-edit { background: #3498db; color: white; }
      .btn-delete { background: #e74c3c; color: white; }
      .btn-deactivate { background: #f39c12; color: white; }
      .btn-activate { background: #27ae60; color: white; }
      .btn-disable { background: #e74c3c; color: white; padding: 6px 14px; font-size: 13px; border-radius: 6px; }
      .btn-enable { background: #27ae60; color: white; padding: 6px 14px; font-size: 13px; border-radius: 6px; }
      .product-card.sold-out { opacity: 0.7; }
      .product-card.sold-out h5 { color: #e74c3c; }
      .product-card.deactivated { opacity: 0.5; border-color: #f39c12; }
      .product-card.deactivated h5 { color: #f39c12; }
      .price-sold-out { text-decoration: line-through; }
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
      .vendor-browse-card.store-disabled {
        opacity: 0.6;
        border-color: #e74c3c;
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
      .disabled-badge {
        display: inline-block;
        background: #e74c3c;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        margin-top: 4px;
      }
      .deactivated-badge {
        display: inline-block;
        background: #f39c12;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
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
  `;

  // Helper for admin vendor page header
  function adminVendorHeader(user) {
    const avatarContent = getAvatarContent(user);
    return `
      <div class="dashboard-header">
        <h1>🏎️ Admin Dashboard</h1>
        <div class="user-info">
          <div class="user-avatar">${avatarContent}</div>
          <a href="/admin/profile" class="profile-btn">Profile</a>
          <a href="/logout" class="logout-btn">Sign Out</a>
        </div>
      </div>`;
  }

  // ── Vendor List ────────────────────────────────────────────────
  router.get('/vendors', requireAdmin, async (req, res) => {
    const user = req.session.user;

    try {
      const vendors = await db.allAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE u.role = 'vendor' AND u.is_active = 1
              ORDER BY vb.business_name, u.name`);

      const vendorCards = vendors.length > 0 ? vendors.map(v => {
        const addressParts = [v.business_street, v.business_city, v.business_state].filter(Boolean);
        const addressLine = addressParts.length > 0
          ? (v.business_street ? v.business_street + (v.business_city || v.business_state ? ', ' : '') : '')
            + (v.business_city ? v.business_city + (v.business_state ? ', ' : '') : '')
            + (v.business_state || '')
            + (v.business_zip ? ' ' + v.business_zip : '')
          : '';
        const isDisabled = v.admin_disabled;

        return `
          <a href="/admin/vendors/${v.user_id}" class="vendor-browse-card${isDisabled ? ' store-disabled' : ''}">
            <div class="vendor-browse-image">
              ${v.image_url
                ? `<img src="${v.image_url}" alt="${v.business_name || v.vendor_name}">`
                : `<div class="vendor-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;background:linear-gradient(135deg,#1a1a2e,#16213e);">🏪</div>`
              }
            </div>
            <div class="vendor-browse-info">
              <div class="vendor-browse-name">${v.business_name || v.vendor_name}</div>
              ${v.business_email ? `<div class="vendor-browse-detail">${v.business_email}</div>` : ''}
              ${v.business_phone ? `<div class="vendor-browse-detail">${v.business_phone}</div>` : ''}
              ${addressLine ? `<div class="vendor-browse-detail">${addressLine}</div>` : ''}
              ${v.business_description ? `<div class="vendor-browse-desc">${v.business_description}</div>` : ''}
              ${isDisabled ? `<div class="disabled-badge">Store Disabled</div>` : ''}
            </div>
          </a>`;
      }).join('') : '<p style="color: #666; text-align: center; padding: 20px;">No vendors have registered yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vendors - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          ${vendorStyles}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            ${adminVendorHeader(user)}
            ${adminNav('vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}

            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading vendors: ' + err.message, '/admin/dashboard', 'Back to Dashboard'));
    }
  });

  // ── Vendor Detail ──────────────────────────────────────────────
  router.get('/vendors/:id', requireAdmin, async (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;

    try {
      const business = await db.getAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId]);

      if (!business) return res.redirect('/admin/vendors');

      const products = await db.allAsync('SELECT * FROM vendor_products WHERE user_id = ? ORDER BY display_order, product_id', [vendorUserId]);

      const addressParts = [business.business_street, business.business_city, business.business_state].filter(Boolean);
      const addressLine = addressParts.length > 0
        ? (business.business_street ? business.business_street + (business.business_city || business.business_state ? ', ' : '') : '')
          + (business.business_city ? business.business_city + (business.business_state ? ', ' : '') : '')
          + (business.business_state || '')
          + (business.business_zip ? ' ' + business.business_zip : '')
        : '';

      const isDisabled = business.admin_disabled;

      const productsHtml = products.length > 0 ? products.map(p => {
        const soldOut = !p.available;
        const deactivated = p.admin_deactivated;
        let cardClass = '';
        if (deactivated) cardClass = ' deactivated';
        else if (soldOut) cardClass = ' sold-out';

        return `
        <a href="/admin/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link" style="text-decoration:none;color:inherit;display:block;">
          <div class="product-card${cardClass}">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
            <div class="product-info">
              <h5>${p.product_name}${deactivated ? ' - DEACTIVATED' : (soldOut ? ' - SOLD OUT' : '')}${deactivated ? '<span class="deactivated-badge">Admin Deactivated</span>' : ''}</h5>
              ${p.description ? `<p>${p.description}</p>` : ''}
              ${p.price ? (p.discount_price
                ? `<p style="font-weight:600;color:#e94560;"><span style="text-decoration:line-through;color:#999;">$${p.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${p.discount_price}</span></p>`
                : `<p style="font-weight:600;color:#e94560;${soldOut ? 'text-decoration:line-through;' : ''}">$${p.price}</p>`
              ) : ''}
              <div class="product-actions">
                ${deactivated
                  ? `<a href="#" onclick="if(confirm('Reactivate this product?'))document.getElementById('activateProd${p.product_id}').submit();return false;" class="btn-sm btn-activate">Reactivate</a>`
                  : `<a href="#" onclick="if(confirm('Deactivate this product? It will be hidden from all users except the vendor and admin.'))document.getElementById('deactivateProd${p.product_id}').submit();return false;" class="btn-sm btn-deactivate">Deactivate</a>`
                }
                <a href="#" onclick="if(confirm('Permanently delete this product? This cannot be undone.'))document.getElementById('delProd${p.product_id}').submit();return false;" class="btn-sm btn-delete">Delete</a>
                <form id="deactivateProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/deactivate-product/${p.product_id}" style="display:none;"></form>
                <form id="activateProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/activate-product/${p.product_id}" style="display:none;"></form>
                <form id="delProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/delete-product/${p.product_id}" style="display:none;"></form>
              </div>
            </div>
          </div>
        </a>`;
      }).join('') : '<p style="color:#888;font-style:italic;">No products or services listed yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${business.business_name || business.vendor_name} - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          ${vendorStyles}
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
            .booth-info {
              font-size: 16px;
              color: #333;
              font-weight: 600;
            }
            .store-status-banner {
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 16px;
              font-weight: 600;
              text-align: center;
              font-size: 14px;
            }
            .store-status-banner.disabled {
              background: #fde8e8;
              color: #e74c3c;
              border: 1px solid #e74c3c;
            }
            .store-status-banner.active {
              background: #e8f5e9;
              color: #27ae60;
              border: 1px solid #27ae60;
            }
            .product-card-link { text-decoration: none; color: inherit; display: block; }
            .product-card-link:active .product-card { background: #eef; }
            @media (min-width: 768px) {
              .product-card-link:hover .product-card { border-color: #e94560; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
              .vendor-detail-image {
                width: 120px;
                height: 120px;
              }
              .vendor-detail-info h3 {
                font-size: 22px;
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            ${adminVendorHeader(user)}
            ${adminNav('vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

            ${isDisabled ? `
              <div class="store-status-banner disabled">
                Store Disabled by Admin — Hidden from all users
                <form method="POST" action="/admin/vendors/${vendorUserId}/enable-store" style="display:inline;margin-left:12px;">
                  <button type="submit" class="btn-enable" onclick="return confirm('Re-enable this vendor store?')">Enable Store</button>
                </form>
              </div>
            ` : `
              <div class="store-status-banner active">
                Store Active — Visible to all users
                <form method="POST" action="/admin/vendors/${vendorUserId}/disable-store" style="display:inline;margin-left:12px;">
                  <button type="submit" class="btn-disable" onclick="return confirm('Disable this entire vendor store? It will be hidden from all users.')">Disable Store</button>
                </form>
              </div>
            `}

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
              <h4>Products &amp; Services (${products.length})</h4>
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
              <a href="/admin/vendors">&larr; Back to Vendors</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading vendor: ' + err.message, '/admin/vendors', 'Back to Vendors'));
    }
  });

  // ── Vendor Product Detail ──────────────────────────────────────
  router.get('/vendors/:vendorId/product/:productId', requireAdmin, async (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      const business = await db.getAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId]);

      if (!business) return res.redirect('/admin/vendors');

      const product = await db.getAsync('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
      if (!product) return res.redirect(`/admin/vendors/${vendorUserId}`);

      const soldOut = !product.available;
      const deactivated = product.admin_deactivated;
      const businessName = business.business_name || business.vendor_name;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${product.product_name} - ${businessName} - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          ${vendorStyles}
          <style>
            .product-detail-image {
              width: 100%;
              max-width: 500px;
              border-radius: 12px;
              overflow: hidden;
              margin: 0 auto 20px;
              border: 2px solid #e1e1e1;
            }
            .product-detail-image img {
              width: 100%;
              display: block;
            }
            .product-detail-name {
              font-size: 22px;
              font-weight: 700;
              color: #1a1a2e;
              margin-bottom: 8px;
            }
            .product-detail-name.sold-out {
              color: #e74c3c;
            }
            .product-detail-name.deactivated {
              color: #f39c12;
            }
            .product-detail-vendor {
              font-size: 14px;
              color: #888;
              margin-bottom: 16px;
            }
            .product-detail-desc {
              font-size: 15px;
              color: #555;
              line-height: 1.6;
              margin-bottom: 16px;
            }
            .product-detail-price {
              font-size: 20px;
              font-weight: 700;
              color: #e94560;
              margin-bottom: 8px;
            }
            .product-detail-price.sold-out {
              text-decoration: line-through;
            }
            .product-detail-status {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 13px;
              font-weight: 600;
              margin-bottom: 20px;
            }
            .product-detail-status.available {
              background: #e8f5e9;
              color: #27ae60;
            }
            .product-detail-status.sold-out {
              background: #fde8e8;
              color: #e74c3c;
            }
            .product-detail-status.deactivated {
              background: #fff3cd;
              color: #856404;
            }
            .admin-actions {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e1e1e1;
            }
            @media (min-width: 768px) {
              .product-detail-name { font-size: 26px; }
              .product-detail-price { font-size: 24px; }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            ${adminVendorHeader(user)}
            ${adminNav('vendors', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

            ${product.image_url ? `
            <div class="product-detail-image">
              <img src="${product.image_url}" alt="${product.product_name}">
            </div>
            ` : ''}

            <div class="product-detail-name${deactivated ? ' deactivated' : (soldOut ? ' sold-out' : '')}">${product.product_name}${deactivated ? ' - DEACTIVATED' : (soldOut ? ' - SOLD OUT' : '')}</div>
            <div class="product-detail-vendor">by ${businessName}</div>

            ${deactivated
              ? `<span class="product-detail-status deactivated">Deactivated by Admin</span>`
              : `<span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>`
            }

            ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
            ${product.price ? (product.discount_price
              ? `<div class="product-detail-price"><span style="text-decoration:line-through;color:#999;font-size:0.8em;">$${product.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${product.discount_price}</span></div>`
              : `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>`
            ) : ''}

            <div class="admin-actions">
              ${deactivated
                ? `<form method="POST" action="/admin/vendors/${vendorUserId}/activate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-activate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Reactivate this product?')">Reactivate Product</button>
                  </form>`
                : `<form method="POST" action="/admin/vendors/${vendorUserId}/deactivate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-deactivate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Deactivate this product?')">Deactivate Product</button>
                  </form>`
              }
              <form method="POST" action="/admin/vendors/${vendorUserId}/delete-product/${product.product_id}" style="display:inline;">
                <button type="submit" class="btn-sm btn-delete" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Permanently delete this product? This cannot be undone.')">Delete Product</button>
              </form>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading product: ' + err.message, `/admin/vendors/${vendorUserId}`, 'Back to Vendor'));
    }
  });

  // ── Admin: Deactivate Product ──────────────────────────────────
  router.post('/vendors/:vendorId/deactivate-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      await db.runAsync('UPDATE vendor_products SET admin_deactivated = 1 WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Reactivate Product ──────────────────────────────────
  router.post('/vendors/:vendorId/activate-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      await db.runAsync('UPDATE vendor_products SET admin_deactivated = 0 WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Delete Product ──────────────────────────────────────
  router.post('/vendors/:vendorId/delete-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      const product = await db.getAsync('SELECT image_url FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
      if (product && product.image_url) {
        const imagePath = path.join(__dirname, '..', product.image_url);
        fs.unlink(imagePath, () => {});
      }
      await db.runAsync('DELETE FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Disable Store ───────────────────────────────────────
  router.post('/vendors/:vendorId/disable-store', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;

    try {
      await db.runAsync('UPDATE vendor_business SET admin_disabled = 1 WHERE user_id = ?', [vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Enable Store ────────────────────────────────────────
  router.post('/vendors/:vendorId/enable-store', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;

    try {
      await db.runAsync('UPDATE vendor_business SET admin_disabled = 0 WHERE user_id = ?', [vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  return router;
};
