// routes/adminConfig.js - Admin configuration routes: vehicle types, classes,
// judge categories, judge questions, specialty votes config, and app config
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload, saveConfig) {
  const { requireAdmin } = require('../middleware/auth');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getInitials, getAvatarContent, adminNav } = require('../views/components');
  const { handleBackgroundImageUpload, deleteBackgroundImage } = require('../helpers/imageUpload');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => { const u = req.session && req.session.user; return `<body data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`; };

  // ==========================================
  // VEHICLE CONFIG & TYPES
  // ==========================================

  // Vehicle config hub page (combined vehicle types + classes)
  router.get('/vehicle-config', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get vehicle types
    db.all('SELECT * FROM vehicles ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      // Get classes with vehicle names
      db.all(`SELECT c.*, v.vehicle_name
              FROM classes c
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
        if (err) classes = [];

        // Check which vehicle types have classes (for delete validation)
        db.all('SELECT DISTINCT vehicle_id FROM classes', (err, usedVehicleIds) => {
          const usedVehicleSet = new Set((usedVehicleIds || []).map(r => r.vehicle_id));

          // Check which classes have cars
          db.all('SELECT DISTINCT class_id FROM cars', (err, usedClassIds) => {
            const usedClassSet = new Set((usedClassIds || []).map(r => r.class_id));

            const vehicleRows = vehicleTypes.map(v => {
              const hasClasses = usedVehicleSet.has(v.vehicle_id);
              return `
                <tr>
                  <td>${v.vehicle_name}</td>
                  <td>$${(v.registration_price || 0).toFixed(2)}</td>
                  <td><span class="status-badge ${v.is_active ? 'active' : 'inactive'}">${v.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <a href="/admin/edit-vehicle-type/${v.vehicle_id}" class="action-btn edit">Edit</a>
                    ${!hasClasses ? `<a href="#" onclick="confirmDeleteVehicleType(${v.vehicle_id}, '${v.vehicle_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>` : ''}
                  </td>
                </tr>
              `;
            }).join('');

            const classRows = classes.map(c => {
              const hasCars = usedClassSet.has(c.class_id);
              return `
                <tr>
                  <td>${c.class_name}</td>
                  <td>${c.vehicle_name || 'N/A'}</td>
                  <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <a href="/admin/edit-class/${c.class_id}" class="action-btn edit">Edit</a>
                    ${!hasCars ? `<a href="#" onclick="confirmDeleteClass(${c.class_id}, '${c.class_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>` : ''}
                  </td>
                </tr>
              `;
            }).join('');

            const vehicleOptionsHtml = vehicleTypes.filter(v => v.is_active).map(v =>
              `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
            ).join('');

            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Vehicle Config - Admin</title>
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
                    <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                    <a href="/admin">Users</a>
                    <a href="/admin/vehicles">Vehicles</a>
                    <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                    <a href="/admin/reports">Reports</a>
                    <a href="/admin/vendors">Vendors</a>
                    ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                    <a href="/user/vote">Vote Here!</a>
                  </div>

                  <h3 class="section-title">Vehicle Types</h3>
                  <p style="color:#666;margin-bottom:15px;">Define types like Car, Truck, Motorcycle, etc.</p>

                  <form method="POST" action="/admin/add-vehicle-type" style="margin-bottom:20px;">
                    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                      <input type="text" name="vehicle_name" required placeholder="New vehicle type name" style="flex:1;min-width:200px;">
                      <div style="display:flex;flex-direction:column;gap:2px;">
                        <label style="font-size:12px;margin-bottom:0;">Registration Price</label>
                        <div style="display:flex;align-items:center;gap:4px;">
                          <span style="font-weight:600;font-size:16px;">$</span>
                          <input type="text" name="registration_price" value="${parseFloat(appConfig.defaultRegistrationPrice || 25).toFixed(2)}" placeholder="25.00" style="width:100px;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                        </div>
                      </div>
                      <button type="submit" style="white-space:nowrap;">Add Type</button>
                    </div>
                  </form>

                  <div class="table-wrapper">
                    <table class="user-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${vehicleRows || '<tr><td colspan="4" style="text-align:center;color:#666;">No vehicle types defined yet.</td></tr>'}
                      </tbody>
                    </table>
                  </div>

                  <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;">

                  <h3 class="section-title">Vehicle Classes</h3>
                  <p style="color:#666;margin-bottom:15px;">Define classes like Street Rod, Muscle Car, Custom, etc.</p>

                  <form method="POST" action="/admin/add-class" style="margin-bottom:20px;">
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                      <select name="vehicle_id" required style="min-width:150px;">
                        <option value="">Select Type...</option>
                        ${vehicleOptionsHtml}
                      </select>
                      <input type="text" name="class_name" required placeholder="New class name" style="flex:1;min-width:200px;">
                      <button type="submit" style="white-space:nowrap;">Add Class</button>
                    </div>
                  </form>

                  <div class="table-wrapper">
                    <table class="user-table">
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th>Vehicle Type</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${classRows || '<tr><td colspan="4" style="text-align:center;color:#666;">No classes defined yet.</td></tr>'}
                      </tbody>
                    </table>
                  </div>
                  <div class="links" style="margin-top:20px;">
                    <a href="/admin/dashboard">&larr; Back to Dashboard</a>
                  </div>
                </div>

                <script>
                  function confirmDeleteVehicleType(id, name) {
                    if (confirm('Are you sure you want to delete the vehicle type "' + name + '"?\\n\\nThis action cannot be undone.')) {
                      window.location.href = '/admin/delete-vehicle-type/' + id;
                    }
                  }

                  function confirmDeleteClass(id, name) {
                    if (confirm('Are you sure you want to delete the class "' + name + '"?\\n\\nThis action cannot be undone.')) {
                      window.location.href = '/admin/delete-class/' + id;
                    }
                  }

                  function validatePriceInput(el) {
                    var val = el.value.replace(/[^0-9.]/g, '');
                    var parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2);
                    el.value = val;
                  }

                  function formatPriceBlur(el) {
                    var num = parseFloat(el.value);
                    if (!isNaN(num) && num >= 0) {
                      el.value = num.toFixed(2);
                    } else if (el.value === '') {
                      el.value = '0.00';
                    }
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

  // Vehicle types management page (legacy - NOT USED, redirects to vehicle-config)
  router.get('/vehicle-types', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.all('SELECT * FROM vehicles ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      const rows = vehicleTypes.map(v => `
        <tr>
          <td>${v.vehicle_name}</td>
          <td><span class="status-badge ${v.is_active ? 'active' : 'inactive'}">${v.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <a href="/admin/edit-vehicle-type/${v.vehicle_id}" class="action-btn edit">Edit</a>
          </td>
        </tr>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vehicle Types - Admin</title>
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
              <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Vehicle Types</h3>
            <p style="color:#666;margin-bottom:15px;">Define types like Car, Truck, Motorcycle, etc.</p>

            <form method="POST" action="/admin/add-vehicle-type" style="margin-bottom:20px;">
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <input type="text" name="vehicle_name" required placeholder="New vehicle type name" style="flex:1;min-width:200px;">
                <button type="submit" style="white-space:nowrap;">Add Type</button>
              </div>
            </form>

            <div class="table-wrapper">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="3" style="text-align:center;color:#666;">No vehicle types defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // Add vehicle type
  router.post('/add-vehicle-type', requireAdmin, (req, res) => {
    const { vehicle_name, registration_price } = req.body;
    if (registration_price && !/^\d+(\.\d{1,2})?$/.test(registration_price.trim())) {
      return res.send(errorPage('Invalid price. Enter a number like 25 or 25.00.', '/admin/vehicle-config', 'Try Again'));
    }
    const price = parseFloat(registration_price) || parseFloat(appConfig.defaultRegistrationPrice) || 25.00;
    db.run('INSERT INTO vehicles (vehicle_name, registration_price) VALUES (?, ?)', [vehicle_name, Math.round(price * 100) / 100], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });

  // Delete vehicle type (only if no classes use it)
  router.get('/delete-vehicle-type/:id', requireAdmin, (req, res) => {
    const vehicleId = req.params.id;

    // Check if any classes use this vehicle type
    db.get('SELECT COUNT(*) as count FROM classes WHERE vehicle_id = ?', [vehicleId], (err, row) => {
      if (err || row.count > 0) {
        // Has classes, cannot delete
        res.redirect('/admin/vehicle-config');
        return;
      }

      // Safe to delete
      db.run('DELETE FROM vehicles WHERE vehicle_id = ?', [vehicleId], (err) => {
        res.redirect('/admin/vehicle-config');
      });
    });
  });

  // Edit vehicle type page
  router.get('/edit-vehicle-type/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const vehicleId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM vehicles WHERE vehicle_id = ?', [vehicleId], (err, vehicle) => {
      if (err || !vehicle) {
        res.redirect('/admin/vehicle-config');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Vehicle Type - Admin</title>
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

            <h3 class="section-title">Edit Vehicle Type</h3>

            <form method="POST" action="/admin/edit-vehicle-type/${vehicle.vehicle_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Name</label>
                  <input type="text" name="vehicle_name" required value="${vehicle.vehicle_name}">
                </div>
                <div class="form-group">
                  <label>Registration Price</label>
                  <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-weight:600;font-size:16px;">$</span>
                    <input type="text" name="registration_price" value="${parseFloat(vehicle.registration_price || 0).toFixed(2)}" required style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                  </div>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${vehicle.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!vehicle.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Vehicle Type</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/vehicle-config">Back to Vehicle Config</a>
            </div>
          </div>
          <script>
            function validatePriceInput(el) {
              var val = el.value.replace(/[^0-9.]/g, '');
              var parts = val.split('.');
              if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
              if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2);
              el.value = val;
            }
            function formatPriceBlur(el) {
              var num = parseFloat(el.value);
              if (!isNaN(num) && num >= 0) {
                el.value = num.toFixed(2);
              } else if (el.value === '') {
                el.value = '0.00';
              }
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // Update vehicle type
  router.post('/edit-vehicle-type/:id', requireAdmin, (req, res) => {
    const vehicleId = req.params.id;
    const { vehicle_name, is_active, registration_price } = req.body;
    if (!/^\d+(\.\d{1,2})?$/.test((registration_price || '').trim())) {
      return res.send(errorPage('Invalid price. Enter a number like 25 or 25.00.', '/admin/edit-vehicle-type/' + vehicleId, 'Try Again'));
    }
    const price = Math.round((parseFloat(registration_price) || 0) * 100) / 100;
    db.run('UPDATE vehicles SET vehicle_name = ?, is_active = ?, registration_price = ? WHERE vehicle_id = ?',
      [vehicle_name, is_active, price, vehicleId], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });

  // ==========================================
  // CLASSES
  // ==========================================

  // Classes management page (legacy - NOT USED, may redirect)
  router.get('/classes', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      db.all(`SELECT c.*, v.vehicle_name
              FROM classes c
              LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
        if (err) classes = [];

        const rows = classes.map(c => `
          <tr>
            <td>${c.class_name}</td>
            <td>${c.vehicle_name || 'N/A'}</td>
            <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <a href="/admin/edit-class/${c.class_id}" class="action-btn edit">Edit</a>
            </td>
          </tr>
        `).join('');

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Classes - Admin</title>
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
                <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Vehicle Classes</h3>
              <p style="color:#666;margin-bottom:15px;">Define classes like Street Rod, Muscle Car, Custom, etc.</p>

              <form method="POST" action="/admin/add-class" style="margin-bottom:20px;">
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <select name="vehicle_id" required style="min-width:150px;">
                    <option value="">Select Type...</option>
                    ${vehicleOptionsHtml}
                  </select>
                  <input type="text" name="class_name" required placeholder="New class name" style="flex:1;min-width:200px;">
                  <button type="submit" style="white-space:nowrap;">Add Class</button>
                </div>
              </form>

              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Class Name</th>
                      <th>Vehicle Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || '<tr><td colspan="4" style="text-align:center;color:#666;">No classes defined yet.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Add class
  router.post('/add-class', requireAdmin, (req, res) => {
    const { vehicle_id, class_name } = req.body;
    db.run('INSERT INTO classes (vehicle_id, class_name) VALUES (?, ?)', [vehicle_id, class_name], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });

  // Delete class (only if no cars use it)
  router.get('/delete-class/:id', requireAdmin, (req, res) => {
    const classId = req.params.id;

    // Check if any cars use this class
    db.get('SELECT COUNT(*) as count FROM cars WHERE class_id = ?', [classId], (err, row) => {
      if (err || row.count > 0) {
        // Has cars, cannot delete
        res.redirect('/admin/vehicle-config');
        return;
      }

      // Safe to delete
      db.run('DELETE FROM classes WHERE class_id = ?', [classId], (err) => {
        res.redirect('/admin/vehicle-config');
      });
    });
  });

  // Edit class page
  router.get('/edit-class/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const classId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM classes WHERE class_id = ?', [classId], (err, classItem) => {
      if (err || !classItem) {
        res.redirect('/admin/vehicle-config');
        return;
      }

      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${classItem.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Edit Class - Admin</title>
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

              <h3 class="section-title">Edit Class</h3>

              <form method="POST" action="/admin/edit-class/${classItem.class_id}">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Vehicle Type</label>
                    <select name="vehicle_id" required>
                      ${vehicleOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Class Name</label>
                    <input type="text" name="class_name" required value="${classItem.class_name}">
                  </div>
                  <div class="form-group">
                    <label>Status</label>
                    <select name="is_active">
                      <option value="1" ${classItem.is_active ? 'selected' : ''}>Active</option>
                      <option value="0" ${!classItem.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                  </div>
                  <button type="submit">Update Class</button>
                </div>
              </form>

              <div class="links" style="margin-top:20px;">
                <a href="/admin/vehicle-config">Back to Vehicle Config</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Update class
  router.post('/edit-class/:id', requireAdmin, (req, res) => {
    const classId = req.params.id;
    const { vehicle_id, class_name, is_active } = req.body;
    db.run('UPDATE classes SET vehicle_id = ?, class_name = ?, is_active = ? WHERE class_id = ?',
      [vehicle_id, class_name, is_active, classId], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });

  // ==========================================
  // JUDGE CATEGORIES
  // ==========================================

  // Judge categories management page
  router.get('/categories', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      db.all(`SELECT jc.*, v.vehicle_name,
                     (SELECT COUNT(*) FROM judge_questions jq WHERE jq.judge_catagory_id = jc.judge_catagory_id) as question_count
              FROM judge_catagories jc
              LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
              ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name`, (err, categories) => {
        if (err) categories = [];

        const rows = categories.map(c => `
          <tr style="border-bottom:none;">
            <td style="border-bottom:none;">${c.catagory_name}</td>
            <td style="border-bottom:none;">${c.vehicle_name || 'N/A'}</td>
            <td style="border-bottom:none;">${c.display_order}</td>
            <td style="border-bottom:none;">${c.question_count}</td>
            <td style="border-bottom:none;"><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
          </tr>
          <tr>
            <td colspan="5" style="border-top:none;padding-top:0;text-align:center;">
              <a href="/admin/edit-category/${c.judge_catagory_id}" class="action-btn edit">Edit</a>
              <a href="/admin/category-questions/${c.judge_catagory_id}" class="action-btn" style="background:#3498db;">Questions</a>
              <a href="#" onclick="confirmDeleteCategory(${c.judge_catagory_id}, '${c.catagory_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
            </td>
          </tr>
        `).join('');

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Judging Categories - Admin</title>
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
                <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Judging Categories</h3>
              <p style="color:#666;margin-bottom:15px;">Define judging categories like Engine, Paint, Interior, etc.</p>

              <form method="POST" action="/admin/add-category" style="margin-bottom:20px;">
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <select name="vehicle_id" required style="min-width:150px;">
                    <option value="">Select Type...</option>
                    ${vehicleOptionsHtml}
                  </select>
                  <input type="text" name="catagory_name" required placeholder="Category name" style="flex:1;min-width:150px;">
                  <input type="text" name="display_order" value="0" placeholder="Order" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  <button type="submit" style="white-space:nowrap;">Add Category</button>
                </div>
              </form>

              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Category Name</th>
                      <th>Vehicle Type</th>
                      <th>Order</th>
                      <th>Questions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No categories defined yet.</td></tr>'}
                  </tbody>
                </table>
              </div>
              <div class="links" style="margin-top:20px;">
                <a href="/admin/dashboard">&larr; Back to Dashboard</a>
              </div>
            </div>

            <script>
              function confirmDeleteCategory(id, name) {
                if (confirm('Are you sure you want to delete the category "' + name + '"?\\n\\nThis will also delete ALL questions in this category.\\n\\nThis action cannot be undone.')) {
                  window.location.href = '/admin/delete-category/' + id;
                }
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });

  // Add category
  router.post('/add-category', requireAdmin, (req, res) => {
    const { vehicle_id, catagory_name, display_order } = req.body;
    db.run('INSERT INTO judge_catagories (vehicle_id, catagory_name, display_order) VALUES (?, ?, ?)',
      [vehicle_id, catagory_name, display_order || 0], (err) => {
      res.redirect('/admin/categories');
    });
  });

  // Delete category (also deletes all questions in this category)
  router.get('/delete-category/:id', requireAdmin, (req, res) => {
    const categoryId = req.params.id;

    // First delete all questions for this category
    db.run('DELETE FROM judge_questions WHERE judge_catagory_id = ?', [categoryId], (err) => {
      // Then delete the category itself
      db.run('DELETE FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err) => {
        res.redirect('/admin/categories');
      });
    });
  });

  // Edit category page
  router.get('/edit-category/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const categoryId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${category.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Edit Category - Admin</title>
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

              <h3 class="section-title">Edit Category</h3>

              <form method="POST" action="/admin/edit-category/${category.judge_catagory_id}">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Vehicle Type</label>
                    <select name="vehicle_id" required>
                      ${vehicleOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Category Name</label>
                    <input type="text" name="catagory_name" required value="${category.catagory_name}">
                  </div>
                  <div class="form-group">
                    <label>Display Order</label>
                    <input type="text" name="display_order" value="${category.display_order}" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group">
                    <label>Status</label>
                    <select name="is_active">
                      <option value="1" ${category.is_active ? 'selected' : ''}>Active</option>
                      <option value="0" ${!category.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                  </div>
                  <button type="submit">Update Category</button>
                </div>
              </form>

              <div class="links" style="margin-top:20px;">
                <a href="/admin/categories">Back to Judge Config</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Update category
  router.post('/edit-category/:id', requireAdmin, (req, res) => {
    const categoryId = req.params.id;
    const { vehicle_id, catagory_name, display_order, is_active } = req.body;
    db.run('UPDATE judge_catagories SET vehicle_id = ?, catagory_name = ?, display_order = ?, is_active = ? WHERE judge_catagory_id = ?',
      [vehicle_id, catagory_name, display_order || 0, is_active, categoryId], (err) => {
      res.redirect('/admin/categories');
    });
  });

  // ==========================================
  // JUDGE QUESTIONS
  // ==========================================

  // Category questions page
  router.get('/category-questions/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const categoryId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get(`SELECT jc.*, v.vehicle_name
            FROM judge_catagories jc
            LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
            WHERE jc.judge_catagory_id = ?`, [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.all(`SELECT * FROM judge_questions WHERE judge_catagory_id = ? ORDER BY display_order, question`,
        [categoryId], (err, questions) => {
        if (err) questions = [];

        const rows = questions.map(q => `
          <tr>
            <td>${q.question}</td>
            <td>${q.min_score} - ${q.max_score}</td>
            <td>${q.display_order}</td>
            <td><span class="status-badge ${q.is_active ? 'active' : 'inactive'}">${q.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <a href="/admin/edit-question/${q.judge_question_id}" class="action-btn edit">Edit</a>
              <a href="#" onclick="confirmDeleteQuestion(${q.judge_question_id}, '${q.question.replace(/'/g, "\\'")}', ${categoryId}); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
            </td>
          </tr>
        `).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Questions: ${category.catagory_name} - Admin</title>
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

              <h3 class="section-title">Questions: ${category.catagory_name}</h3>
              <p style="color:#666;margin-bottom:15px;">Vehicle Type: ${category.vehicle_name}</p>

              <form method="POST" action="/admin/add-question/${category.judge_catagory_id}" style="margin-bottom:20px;">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Question</label>
                    <input type="text" name="question" required placeholder="e.g., Condition of paint finish">
                  </div>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Min Score</label>
                      <input type="text" name="min_score" value="${appConfig.defaultMinScore ?? 0}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Max Score</label>
                      <input type="text" name="max_score" value="${appConfig.defaultMaxScore ?? 10}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Order</label>
                      <input type="text" name="display_order" value="0" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                  </div>
                  <button type="submit">Add Question</button>
                </div>
              </form>

              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Score Range</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No questions defined yet.</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div class="links" style="margin-top:20px;">
                <a href="/admin/categories">Back to Judge Config</a>
              </div>
            </div>

            <script>
              function confirmDeleteQuestion(id, name, categoryId) {
                if (confirm('Are you sure you want to delete this question?\\n\\n"' + name + '"\\n\\nThis action cannot be undone.')) {
                  window.location.href = '/admin/delete-question/' + id + '?categoryId=' + categoryId;
                }
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });

  // Add question
  router.post('/add-question/:categoryId', requireAdmin, (req, res) => {
    const categoryId = req.params.categoryId;
    const { question, min_score, max_score, display_order } = req.body;

    if (!/^\d+$/.test((min_score || '').trim()) || !/^\d+$/.test((max_score || '').trim())) {
      return res.send(errorPage('Min Score and Max Score must be whole numbers.', '/admin/category-questions/' + categoryId, 'Try Again'));
    }

    // Get the vehicle_id from the category
    db.get('SELECT vehicle_id FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.run('INSERT INTO judge_questions (vehicle_id, judge_catagory_id, question, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [category.vehicle_id, categoryId, question, parseInt(min_score) || 0, parseInt(max_score) || 10, parseInt(display_order) || 0], (err) => {
        res.redirect(`/admin/category-questions/${categoryId}`);
      });
    });
  });

  // Delete question
  router.get('/delete-question/:id', requireAdmin, (req, res) => {
    const questionId = req.params.id;
    const categoryId = req.query.categoryId;

    db.run('DELETE FROM judge_questions WHERE judge_question_id = ?', [questionId], (err) => {
      res.redirect(`/admin/category-questions/${categoryId}`);
    });
  });

  // Edit question page
  router.get('/edit-question/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const questionId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get(`SELECT jq.*, jc.catagory_name
            FROM judge_questions jq
            LEFT JOIN judge_catagories jc ON jq.judge_catagory_id = jc.judge_catagory_id
            WHERE jq.judge_question_id = ?`, [questionId], (err, question) => {
      if (err || !question) {
        res.redirect('/admin/categories');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Question - Admin</title>
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

            <h3 class="section-title">Edit Question</h3>
            <p style="color:#666;margin-bottom:15px;">Category: ${question.catagory_name}</p>

            <form method="POST" action="/admin/edit-question/${question.judge_question_id}">
              <input type="hidden" name="judge_catagory_id" value="${question.judge_catagory_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Question</label>
                  <input type="text" name="question" required value="${question.question}">
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Min Score</label>
                    <input type="text" name="min_score" value="${question.min_score}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Max Score</label>
                    <input type="text" name="max_score" value="${question.max_score}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Order</label>
                    <input type="text" name="display_order" value="${question.display_order}" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${question.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!question.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Question</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/category-questions/${question.judge_catagory_id}">Back to Questions</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // Update question
  router.post('/edit-question/:id', requireAdmin, (req, res) => {
    const questionId = req.params.id;
    const { judge_catagory_id, question, min_score, max_score, display_order, is_active } = req.body;

    if (!/^\d+$/.test((min_score || '').trim()) || !/^\d+$/.test((max_score || '').trim())) {
      return res.send(errorPage('Min Score and Max Score must be whole numbers.', '/admin/edit-question/' + questionId, 'Try Again'));
    }

    db.run('UPDATE judge_questions SET question = ?, min_score = ?, max_score = ?, display_order = ?, is_active = ? WHERE judge_question_id = ?',
      [question, parseInt(min_score) || 0, parseInt(max_score) || 10, parseInt(display_order) || 0, is_active, questionId], (err) => {
      res.redirect(`/admin/category-questions/${judge_catagory_id}`);
    });
  });

  // ==========================================
  // SPECIALTY VOTES CONFIG
  // ==========================================

  // Specialty votes management page
  router.get('/specialty-votes', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get vehicle types and classes for the form
    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];
      db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
        if (err) classes = [];

    const vehicleOptionsHtml = vehicleTypes.map(v =>
      `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
    ).join('');
    const classesJson = JSON.stringify(classes);

    // Get specialty votes with vote counts
    db.all(`
      SELECT sv.*,
             (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count,
             v.vehicle_name, cl.class_name
      FROM specialty_votes sv
      LEFT JOIN vehicles v ON sv.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON sv.class_id = cl.class_id
      ORDER BY sv.vote_name
    `, (err, specialtyVotes) => {
      if (err) specialtyVotes = [];

      const rows = specialtyVotes.map(sv => {
        const filterLabel = sv.vehicle_name
          ? (sv.class_name ? `${sv.vehicle_name} / ${sv.class_name}` : sv.vehicle_name)
          : 'All Vehicles';
        return `
        <tr style="border-bottom:none;">
          <td style="border-bottom:none;">${sv.vote_name}</td>
          <td style="border-bottom:none;">${sv.description || '-'}</td>
          <td style="border-bottom:none;">${sv.allow_all_users ? 'All Users' : 'Specific Users'}</td>
          <td style="border-bottom:none;">${filterLabel}</td>
          <td style="border-bottom:none;"><span style="background:#27ae60;color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">${sv.vote_count} votes</span></td>
          <td style="border-bottom:none;"><span class="status-badge ${sv.is_active ? 'active' : 'inactive'}">${sv.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
        <tr>
          <td colspan="6" style="border-top:none;padding-top:0;text-align:center;">
            <a href="/admin/specialty-vote-results/${sv.specialty_vote_id}" class="action-btn" style="background:#27ae60;">Results</a>
            <a href="/admin/edit-specialty-vote/${sv.specialty_vote_id}" class="action-btn edit">Edit</a>
            <a href="/admin/specialty-vote-voters/${sv.specialty_vote_id}" class="action-btn" style="background:#3498db;">Voters</a>
            <a href="#" onclick="confirmDeleteSpecialtyVote(${sv.specialty_vote_id}, '${sv.vote_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
          </td>
        </tr>
      `}).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Special Vote Config - Admin</title>
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
              <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">Special Vote Config</h3>
            <p style="color:#666;margin-bottom:15px;">Configure special voting categories like People's Choice, Best in Show, etc.</p>

            <form method="POST" action="/admin/add-specialty-vote" style="margin-bottom:20px;">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vote Name</label>
                  <input type="text" name="vote_name" required placeholder="e.g., People's Choice">
                </div>
                <div class="form-group">
                  <label>Description (Optional)</label>
                  <input type="text" name="description" placeholder="Brief description of this vote">
                </div>
                <div class="form-group">
                  <label>Who Can Vote?</label>
                  <select name="allow_all_users">
                    <option value="0">Specific Users Only</option>
                    <option value="1">All Users</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Vehicle Type (Optional)</label>
                  <select name="vehicle_id" id="svVehicleType" onchange="updateSvClasses()">
                    <option value="">All Vehicle Types</option>
                    ${vehicleOptionsHtml}
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Class (Optional)</label>
                  <select name="class_id" id="svClassSelect">
                    <option value="">All Classes</option>
                  </select>
                </div>
                <button type="submit">Add Specialty Vote</button>
              </div>
            </form>

            <div class="table-wrapper">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Voters</th>
                    <th>Applies To</th>
                    <th>Votes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="6" style="text-align:center;color:#666;">No specialty votes defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
            </div>
          </div>

          <script>
            const allSvClasses = ${classesJson};

            function updateSvClasses() {
              const vehicleId = document.getElementById('svVehicleType').value;
              const classSelect = document.getElementById('svClassSelect');
              classSelect.innerHTML = '<option value="">All Classes</option>';
              if (vehicleId) {
                const filtered = allSvClasses.filter(c => c.vehicle_id == vehicleId);
                filtered.forEach(c => {
                  classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
                });
              }
            }

            function confirmDeleteSpecialtyVote(id, name) {
              if (confirm('Are you sure you want to delete the specialty vote "' + name + '"?\\n\\nThis will also remove all voter assignments.\\n\\nThis action cannot be undone.')) {
                window.location.href = '/admin/delete-specialty-vote/' + id;
              }
            }
          </script>
        </body>
        </html>
      `);
    });
      }); // end classes query
    }); // end vehicleTypes query
  });

  // Add specialty vote
  router.post('/add-specialty-vote', requireAdmin, (req, res) => {
    const { vote_name, description, allow_all_users, vehicle_id, class_id } = req.body;
    db.run('INSERT INTO specialty_votes (vote_name, description, allow_all_users, vehicle_id, class_id) VALUES (?, ?, ?, ?, ?)',
      [vote_name, description || null, allow_all_users, vehicle_id || null, class_id || null], (err) => {
      res.redirect('/admin/specialty-votes');
    });
  });

  // Edit specialty vote page
  router.get('/edit-specialty-vote/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];
        db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
          if (err) classes = [];

          const editVehicleOptions = vehicleTypes.map(v =>
            `<option value="${v.vehicle_id}" ${vote.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
          ).join('');

          const editClassOptions = vote.vehicle_id
            ? classes.filter(c => c.vehicle_id == vote.vehicle_id).map(c =>
                `<option value="${c.class_id}" ${vote.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
              ).join('')
            : '';

          const editClassesJson = JSON.stringify(classes);

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Specialty Vote - Admin</title>
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

            <h3 class="section-title">Edit Specialty Vote</h3>

            <form method="POST" action="/admin/edit-specialty-vote/${vote.specialty_vote_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vote Name</label>
                  <input type="text" name="vote_name" required value="${vote.vote_name}">
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <input type="text" name="description" value="${vote.description || ''}">
                </div>
                <div class="form-group">
                  <label>Who Can Vote?</label>
                  <select name="allow_all_users">
                    <option value="0" ${!vote.allow_all_users ? 'selected' : ''}>Specific Users Only</option>
                    <option value="1" ${vote.allow_all_users ? 'selected' : ''}>All Users</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Vehicle Type (Optional)</label>
                  <select name="vehicle_id" id="editSvVehicleType" onchange="updateEditSvClasses()">
                    <option value="">All Vehicle Types</option>
                    ${editVehicleOptions}
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Class (Optional)</label>
                  <select name="class_id" id="editSvClassSelect">
                    <option value="">All Classes</option>
                    ${editClassOptions}
                  </select>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${vote.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!vote.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Specialty Vote</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/specialty-votes">Back to Special Vote Config</a>
            </div>
          </div>

          <script>
            const editAllClasses = ${editClassesJson};
            function updateEditSvClasses() {
              const vehicleId = document.getElementById('editSvVehicleType').value;
              const classSelect = document.getElementById('editSvClassSelect');
              classSelect.innerHTML = '<option value="">All Classes</option>';
              if (vehicleId) {
                const filtered = editAllClasses.filter(c => c.vehicle_id == vehicleId);
                filtered.forEach(c => {
                  classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
                });
              }
            }
          </script>
        </body>
        </html>
      `);
        }); // end classes
      }); // end vehicleTypes
    });
  });

  // Update specialty vote
  router.post('/edit-specialty-vote/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;
    const { vote_name, description, allow_all_users, is_active, vehicle_id, class_id } = req.body;
    db.run('UPDATE specialty_votes SET vote_name = ?, description = ?, allow_all_users = ?, is_active = ?, vehicle_id = ?, class_id = ? WHERE specialty_vote_id = ?',
      [vote_name, description || null, allow_all_users, is_active, vehicle_id || null, class_id || null, voteId], (err) => {
      res.redirect('/admin/specialty-votes');
    });
  });

  // Delete specialty vote
  router.get('/delete-specialty-vote/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;

    // First delete all vote results
    db.run('DELETE FROM specialty_vote_results WHERE specialty_vote_id = ?', [voteId], (err) => {
      // Then delete all voter assignments
      db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
        // Then delete the specialty vote
        db.run('DELETE FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err) => {
          res.redirect('/admin/specialty-votes');
        });
      });
    });
  });

  // View/edit specialty vote results
  router.get('/specialty-vote-results/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      // Get vote tallies grouped by car, ordered by vote count
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id, c.image_url,
               u.name as owner_name,
               cl.class_name, v.vehicle_name,
               COUNT(svr.id) as vote_count
        FROM specialty_vote_results svr
        JOIN cars c ON svr.car_id = c.car_id
        LEFT JOIN users u ON c.user_id = u.user_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        WHERE svr.specialty_vote_id = ?
        GROUP BY c.car_id
        ORDER BY vote_count DESC, c.voter_id
      `, [voteId], (err, results) => {
        if (err) results = [];

        // Get total vote count
        const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

        // Determine winner(s) - vehicles with highest vote count
        const maxVotes = results.length > 0 ? results[0].vote_count : 0;
        const winners = results.filter(r => r.vote_count === maxVotes && maxVotes > 0);

        const resultRows = results.map((r, index) => {
          const isWinner = r.vote_count === maxVotes && maxVotes > 0;
          const percentage = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0;
          return `
            <tr style="${isWinner ? 'background:#d4edda;' : ''}">
              <td style="font-weight:700;font-size:18px;">${index + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  ${r.image_url ? `<img src="${r.image_url}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;">` : ''}
                  <div>
                    <div style="font-weight:600;">
                      ${r.voter_id ? `<span style="background:#2c3e50;color:white;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">#${r.voter_id}</span>` : ''}
                      ${r.year || ''} ${r.make} ${r.model}
                    </div>
                    <div style="font-size:12px;color:#666;">${r.owner_name || 'Unknown'}</div>
                  </div>
                </div>
              </td>
              <td>${r.vehicle_name || '-'}</td>
              <td>${r.class_name || '-'}</td>
              <td style="font-weight:700;font-size:16px;">${r.vote_count}</td>
              <td>
                <div style="background:#e1e1e1;border-radius:10px;height:20px;overflow:hidden;">
                  <div style="background:${isWinner ? '#27ae60' : '#3498db'};height:100%;width:${percentage}%;"></div>
                </div>
                <span style="font-size:12px;color:#666;">${percentage}%</span>
              </td>
              <td>${isWinner ? '<span style="background:#27ae60;color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">WINNER</span>' : ''}</td>
            </tr>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Results: ${vote.vote_name} - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
            <style>
              .results-header {
                background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
              }
              .results-header h2 {
                color: white;
                margin-bottom: 5px;
              }
              .stats-row {
                display: flex;
                gap: 15px;
                margin-bottom: 20px;
                flex-wrap: wrap;
              }
              .stat-card {
                flex: 1;
                min-width: 120px;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid #e1e1e1;
              }
              .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                color: #1a1a2e;
              }
              .stat-card .label {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
              }
              .winner-card {
                background: linear-gradient(135deg, #f39c12 0%, #f1c40f 100%);
                color: #1a1a2e;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
              }
              .winner-card h3 {
                margin-bottom: 10px;
              }
              .winner-card .trophy {
                font-size: 48px;
                margin-bottom: 10px;
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

              <div class="results-header">
                <h2>Results: ${vote.vote_name}</h2>
                ${vote.description ? `<p>${vote.description}</p>` : ''}
              </div>

              <div class="stats-row">
                <div class="stat-card">
                  <div class="number">${totalVotes}</div>
                  <div class="label">Total Votes</div>
                </div>
                <div class="stat-card">
                  <div class="number">${results.length}</div>
                  <div class="label">Vehicles Voted For</div>
                </div>
              </div>

              ${winners.length > 0 ? `
                <div class="winner-card">
                  <div class="trophy">🏆</div>
                  <h3>${winners.length > 1 ? 'TIE - Winners' : 'Winner'}</h3>
                  ${winners.map(w => `
                    <div style="font-size:18px;font-weight:600;">
                      ${w.voter_id ? `#${w.voter_id} - ` : ''}${w.year || ''} ${w.make} ${w.model}
                    </div>
                    <div style="font-size:14px;">Owner: ${w.owner_name || 'Unknown'} | ${w.vote_count} votes</div>
                  `).join('<hr style="margin:10px 0;border:none;border-top:1px solid rgba(0,0,0,0.1);">')}
                </div>
              ` : '<p style="text-align:center;color:#666;padding:20px;">No votes have been cast yet.</p>'}

              ${results.length > 0 ? `
                <h3 class="section-title">Full Results</h3>
                <div class="table-wrapper">
                  <table class="user-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Class</th>
                        <th>Votes</th>
                        <th>%</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${resultRows}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              <div class="links" style="margin-top:20px;">
                <a href="/admin/specialty-votes">Back to Special Vote Config</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Manage voters for a specialty vote
  router.get('/specialty-vote-voters/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const saved = req.query.saved;
    const error = req.query.error;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      // Get all users
      db.all('SELECT user_id, username, name, role FROM users WHERE is_active = 1 ORDER BY name', (err, allUsers) => {
        if (err) allUsers = [];

        // Get currently assigned voters
        db.all('SELECT user_id FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err, assignedVoters) => {
          const assignedIds = new Set((assignedVoters || []).map(v => v.user_id));

          const userCheckboxes = allUsers.map(u => `
            <label class="voter-item" data-search="${u.name.toLowerCase()} ${u.username.toLowerCase()} ${u.user_id} ${u.role.toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:8px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" name="user_ids" value="${u.user_id}" ${assignedIds.has(u.user_id) ? 'checked' : ''} style="width:18px;height:18px;">
              <span><strong>${u.name}</strong> (${u.username}) - ${u.role}</span>
            </label>
          `).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Voters: ${vote.vote_name} - Admin</title>
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

                <h3 class="section-title">Voters: ${vote.vote_name}</h3>
                ${saved ? '<div class="success-message" style="margin-bottom:15px;">Voter assignments saved successfully!</div>' : ''}
                ${error ? '<div style="background:#f8d7da;color:#721c24;padding:12px;border-radius:8px;margin-bottom:15px;font-weight:600;">Failed to save voter assignments. Please try again.</div>' : ''}
                ${vote.allow_all_users
                  ? `<div class="profile-card">
                      <div style="background:#d4edda;color:#155724;padding:16px;border-radius:8px;text-align:center;">
                        <strong>All Users</strong><br>
                        <span style="font-size:14px;">This vote is configured to allow all users to participate. No individual voter assignments are needed.</span>
                      </div>
                    </div>`
                  : `<form method="POST" action="/admin/update-specialty-vote-voters/${vote.specialty_vote_id}" id="voterForm">
                  <div class="profile-card">
                    <p style="color:#666;margin-bottom:15px;">Select which users can participate in this vote.</p>
                    <div style="display:flex;gap:10px;margin-bottom:15px;">
                      <button type="button" onclick="selectAll()" style="flex:1;">Select All</button>
                      <button type="button" onclick="selectNone()" style="flex:1;background:#6c757d;">Select None</button>
                    </div>

                    <div class="form-group" style="margin-bottom:15px;">
                      <input type="text" id="voterSearch" placeholder="Search by name, email, or user ID..." oninput="filterVoters()" style="width:100%;padding:10px 14px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
                    </div>

                    <div id="voterList" style="max-height:400px;overflow-y:auto;">
                      ${userCheckboxes || '<p style="color:#666;">No users found.</p>'}
                    </div>

                    <button type="submit" style="margin-top:15px;">Save Voter Assignments</button>
                    <div id="saveMessage" style="display:none;margin-top:10px;padding:10px;border-radius:8px;text-align:center;font-weight:600;"></div>
                  </div>
                </form>`
                }

                <div class="links" style="margin-top:20px;">
                  <a href="/admin/specialty-votes">Back to Special Vote Config</a>
                </div>
              </div>

              <script>
                function selectAll() {
                  document.querySelectorAll('.voter-item').forEach(el => {
                    if (el.style.display !== 'none') el.querySelector('input').checked = true;
                  });
                }
                function selectNone() {
                  document.querySelectorAll('.voter-item').forEach(el => {
                    if (el.style.display !== 'none') el.querySelector('input').checked = false;
                  });
                }
                function filterVoters() {
                  const query = document.getElementById('voterSearch').value.toLowerCase().trim();
                  document.querySelectorAll('.voter-item').forEach(el => {
                    const text = el.getAttribute('data-search');
                    el.style.display = !query || text.includes(query) ? 'flex' : 'none';
                  });
                }
              </script>
            </body>
            </html>
          `);
        });
      });
    });
  });

  // Update voter assignments for a specialty vote
  router.post('/update-specialty-vote-voters/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;
    let userIds = req.body.user_ids || [];

    // Ensure userIds is an array
    if (!Array.isArray(userIds)) {
      userIds = userIds ? [userIds] : [];
    }

    // First delete all existing assignments
    db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
      if (err) {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
        return;
      }

      if (userIds.length === 0) {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
        return;
      }

      // Insert new assignments
      const placeholders = userIds.map(() => '(?, ?)').join(', ');
      const values = [];
      userIds.forEach(userId => {
        values.push(voteId, userId);
      });

      db.run(`INSERT INTO specialty_vote_voters (specialty_vote_id, user_id) VALUES ${placeholders}`, values, (err) => {
        if (err) {
          res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
        } else {
          res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
        }
      });
    });
  });

  // ==========================================
  // APP CONFIG
  // ==========================================

  // Upload login background image
  router.post('/upload-login-background', requireAdmin, upload.single('backgroundImage'), async (req, res) => {
    if (!req.file) {
      return res.send(errorPage('No image file selected.', '/admin/app-config', 'Try Again'));
    }
    try {
      if (!appConfig.loginBackground) appConfig.loginBackground = {};
      const oldImageUrl = appConfig.loginBackground.imageUrl || null;
      const result = await handleBackgroundImageUpload(req.file, oldImageUrl);
      if (result.success) {
        appConfig.loginBackground.imageUrl = result.imageUrl;
        appConfig.loginBackground.useImage = true;
        saveConfig();
        res.redirect('/admin/app-config?saved=1');
      } else {
        res.send(errorPage('Error uploading image: ' + result.error, '/admin/app-config', 'Try Again'));
      }
    } catch (error) {
      res.send(errorPage('Error uploading image: ' + error.message, '/admin/app-config', 'Try Again'));
    }
  });

  // Remove login background image
  router.post('/remove-login-background', requireAdmin, (req, res) => {
    if (appConfig.loginBackground && appConfig.loginBackground.imageUrl) {
      deleteBackgroundImage(appConfig.loginBackground.imageUrl);
      appConfig.loginBackground.imageUrl = '';
      appConfig.loginBackground.useImage = false;
      saveConfig();
    }
    res.redirect('/admin/app-config?saved=1');
  });

  // Upload app background image
  router.post('/upload-app-background', requireAdmin, upload.single('appBackgroundImage'), async (req, res) => {
    if (!req.file) {
      return res.send(errorPage('No image file selected.', '/admin/app-config', 'Try Again'));
    }
    try {
      if (!appConfig.appBackground) appConfig.appBackground = {};
      const oldImageUrl = appConfig.appBackground.imageUrl || null;
      const result = await handleBackgroundImageUpload(req.file, oldImageUrl);
      if (result.success) {
        appConfig.appBackground.imageUrl = result.imageUrl;
        appConfig.appBackground.useImage = true;
        saveConfig();
        res.redirect('/admin/app-config?saved=1');
      } else {
        res.send(errorPage('Error uploading image: ' + result.error, '/admin/app-config', 'Try Again'));
      }
    } catch (error) {
      res.send(errorPage('Error uploading image: ' + error.message, '/admin/app-config', 'Try Again'));
    }
  });

  // Remove app background image
  router.post('/remove-app-background', requireAdmin, (req, res) => {
    if (appConfig.appBackground && appConfig.appBackground.imageUrl) {
      deleteBackgroundImage(appConfig.appBackground.imageUrl);
      appConfig.appBackground.imageUrl = '';
      appConfig.appBackground.useImage = false;
      saveConfig();
    }
    res.redirect('/admin/app-config?saved=1');
  });

  // App config page
  router.get('/app-config', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    const saved = req.query.saved === '1';
    const bg = appConfig.loginBackground || {
      useImage: false, imageUrl: '', backgroundColor: '#1a1a2e',
      useTint: false, tintColor: '#1a1a2e', tintOpacity: 0.5, cardOpacity: 0.98
    };
    const abg = appConfig.appBackground || {
      useImage: false, imageUrl: '', backgroundColor: '#1a1a2e',
      useTint: false, tintColor: '#1a1a2e', tintOpacity: 0.5, containerOpacity: 0.98
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>App Config - Admin</title>
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
            <a href="#" class="active" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Vehicles</a>
            <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
            <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
          </div>

          <h3 class="section-title">Application Configuration</h3>

          ${saved ? '<div class="success-message" style="max-width: 600px; margin-bottom: 20px;">Configuration saved successfully!</div>' : ''}

          <form method="POST" action="/admin/app-config" style="max-width: 600px;">
            <div class="form-group">
              <label>Application Title</label>
              <input type="text" name="appTitle" value="${appConfig.appTitle || ''}" required placeholder="Enter application title">
              <small style="color: #666; display: block; margin-top: 5px;">This appears on the login page</small>
            </div>
            <div class="form-group">
              <label>Login Subtitle</label>
              <input type="text" name="appSubtitle" value="${appConfig.appSubtitle || ''}" placeholder="Enter subtitle (optional)">
              <small style="color: #666; display: block; margin-top: 5px;">Appears below the title on the login page</small>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div class="form-group">
              <label>Default Registration Price</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-weight:600;font-size:16px;">$</span>
                <input type="text" name="defaultRegistrationPrice" value="${parseFloat(appConfig.defaultRegistrationPrice || 25).toFixed(2)}" required style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
              </div>
              <small style="color: #666; display: block; margin-top: 5px;">Default price when creating new vehicle types</small>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Default Judging Points</label>
              <small style="color: #666; display: block; margin-bottom: 10px;">Default min and max score values when adding new judging questions</small>
              <div style="display:flex;gap:15px;flex-wrap:wrap;">
                <div class="form-group" style="flex:0;min-width:80px;">
                  <label>Min Score</label>
                  <input type="text" name="defaultMinScore" value="${appConfig.defaultMinScore ?? 0}" required maxlength="2" style="width:60px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                </div>
                <div class="form-group" style="flex:0;min-width:80px;">
                  <label>Max Score</label>
                  <input type="text" name="defaultMaxScore" value="${appConfig.defaultMaxScore ?? 10}" required maxlength="2" style="width:60px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                </div>
              </div>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Configuration</label>
              <small style="color: #666; display: block; margin-bottom: 12px;">Control the login experience for all users</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="animatedLogin" value="${appConfig.animatedLogin ? 'true' : 'false'}" id="animatedLoginInput">
                  <div id="toggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${appConfig.animatedLogin ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleAnimatedLogin()"></div>
                  <div id="toggleThumb" style="position:absolute;height:20px;width:20px;left:${appConfig.animatedLogin ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;" id="toggleLabel">${appConfig.animatedLogin ? 'Enabled' : 'Disabled'} Animated Login Experience</span>
              </div>
            </div>

            <div style="margin-top:10px;margin-bottom:10px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Group Chat</label>
              <small style="color: #666; display: block; margin-bottom: 12px;">Enable or disable the group chat feature for all users</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="chatEnabled" value="${appConfig.chatEnabled !== false ? 'true' : 'false'}" id="chatEnabledInput">
                  <div id="chatToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${appConfig.chatEnabled !== false ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleChat()"></div>
                  <div id="chatToggleThumb" style="position:absolute;height:20px;width:20px;left:${appConfig.chatEnabled !== false ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;" id="chatToggleLabel">${appConfig.chatEnabled !== false ? 'Enabled' : 'Disabled'} Group Chat</span>
              </div>
            </div>

            <div style="margin-top:10px;margin-bottom:10px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Background Customization</label>
              <small style="color: #666; display: block; margin-bottom: 15px;">Customize the appearance of the login page</small>

              <!-- Background Type Selector -->
              <div class="form-group" style="margin-bottom:15px;">
                <label>Background Type</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button type="button" id="btnSolidColor" onclick="setBgType('color')"
                    style="flex:1;padding:10px;border:2px solid ${bg.useImage ? '#e1e1e1' : '#e94560'};border-radius:8px;background:${bg.useImage ? '#f8f9fa' : '#fff0f3'};cursor:pointer;font-weight:600;color:${bg.useImage ? '#666' : '#e94560'};">
                    Solid Color
                  </button>
                  <button type="button" id="btnBgImage" onclick="setBgType('image')"
                    style="flex:1;padding:10px;border:2px solid ${bg.useImage ? '#e94560' : '#e1e1e1'};border-radius:8px;background:${bg.useImage ? '#fff0f3' : '#f8f9fa'};cursor:pointer;font-weight:600;color:${bg.useImage ? '#e94560' : '#666'};">
                    Background Image
                  </button>
                </div>
                <input type="hidden" name="loginBgUseImage" id="loginBgUseImage" value="${bg.useImage ? 'true' : 'false'}">
              </div>

              <!-- Solid Color Section -->
              <div id="solidColorSection" style="display:${bg.useImage ? 'none' : 'block'};margin-bottom:15px;">
                <label>Background Color</label>
                <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
                  <input type="color" name="loginBgColor" id="loginBgColor" value="${bg.backgroundColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="loginBgColorHex" style="font-family:monospace;color:#666;">${bg.backgroundColor || '#1a1a2e'}</span>
                </div>
              </div>

              <!-- Background Image Section -->
              <div id="bgImageSection" style="display:${bg.useImage ? 'block' : 'none'};margin-bottom:15px;">
                ${bg.imageUrl ? `
                <div style="margin-bottom:12px;">
                  <label>Current Background</label>
                  <div style="position:relative;width:200px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #e1e1e1;margin-top:6px;">
                    <img src="${bg.imageUrl}" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                </div>
                ` : ''}
                <label>${bg.imageUrl ? 'Replace' : 'Upload'} Background Image</label>
                <small style="color:#666;display:block;margin-bottom:8px;">Recommended: 1920x1080 or larger. JPEG, PNG, GIF, or WebP.</small>
                <!-- Placeholder - upload forms will be moved here by JS -->
                <div id="bgImageUploadArea" style="margin-top:8px;"></div>
              </div>
            </div>

            <!-- Tint Overlay (only when image mode) -->
            <div id="tintSection" style="display:${bg.useImage ? 'block' : 'none'};margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="loginBgUseTint" value="${bg.useTint ? 'true' : 'false'}" id="loginBgUseTintInput">
                  <div id="tintToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${bg.useTint ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleTint()"></div>
                  <div id="tintToggleThumb" style="position:absolute;height:20px;width:20px;left:${bg.useTint ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;font-weight:600;">Color Tint Overlay</span>
              </div>
              <div id="tintControls" style="display:${bg.useTint ? 'block' : 'none'};">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                  <label style="margin-bottom:0;min-width:70px;">Tint Color</label>
                  <input type="color" name="loginBgTintColor" id="loginBgTintColor" value="${bg.tintColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="tintColorHex" style="font-family:monospace;color:#666;">${bg.tintColor || '#1a1a2e'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <label style="margin-bottom:0;min-width:70px;">Opacity</label>
                  <input type="range" name="loginBgTintOpacity" id="loginBgTintOpacity" min="0" max="100" value="${Math.round((bg.tintOpacity ?? 0.5) * 100)}"
                    style="flex:1;" oninput="document.getElementById('tintOpacityValue').textContent=this.value+'%'; updatePreview();">
                  <span id="tintOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((bg.tintOpacity ?? 0.5) * 100)}%</span>
                </div>
              </div>
            </div>

            <!-- Card Transparency -->
            <div style="margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Card Transparency</label>
              <small style="color:#666;display:block;margin-bottom:10px;">Controls how see-through the login card is (100% = fully solid, 0% = fully transparent)</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="range" name="loginBgCardOpacity" id="loginBgCardOpacity" min="0" max="100" value="${Math.round((bg.cardOpacity ?? 0.98) * 100)}"
                  style="flex:1;" oninput="document.getElementById('cardOpacityValue').textContent=this.value+'%'; updatePreview();">
                <span id="cardOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((bg.cardOpacity ?? 0.98) * 100)}%</span>
              </div>
            </div>

            <!-- Live Preview -->
            <div style="margin-bottom:20px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Live Preview</label>
              <div id="previewPanel" data-has-image="${bg.useImage && bg.imageUrl ? 'true' : 'false'}" style="position:relative;width:100%;max-width:400px;height:250px;border-radius:12px;overflow:hidden;border:2px solid #e1e1e1;${bg.useImage && bg.imageUrl ? `background:url('${bg.imageUrl}') center/cover no-repeat` : `background:${bg.backgroundColor || '#1a1a2e'}`};">
                <div id="previewTint" style="position:absolute;top:0;left:0;width:100%;height:100%;background:${bg.tintColor || '#1a1a2e'};opacity:${bg.useImage && bg.useTint ? (bg.tintOpacity ?? 0.5) : 0};pointer-events:none;"></div>
                <div id="previewCard" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;background:rgba(255,255,255,${bg.cardOpacity ?? 0.98});border-radius:10px;padding:15px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                  <div style="font-size:28px;margin-bottom:4px;">🏎️</div>
                  <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">${appConfig.appTitle || 'Car Show'}</div>
                  <div style="width:80%;height:6px;background:#e1e1e1;border-radius:3px;margin:4px auto;"></div>
                  <div style="width:80%;height:6px;background:#e1e1e1;border-radius:3px;margin:4px auto;"></div>
                  <div style="width:50%;height:8px;background:linear-gradient(135deg,#e94560,#ff6b6b);border-radius:4px;margin:8px auto 0;"></div>
                </div>
              </div>
            </div>

            <div style="border-top:3px solid #000;margin:20px 0;"></div>

            <!-- App Background Customization -->
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">App Background Customization</label>
              <small style="color: #666; display: block; margin-bottom: 15px;">Customize the background appearance of the app after login</small>

              <!-- Background Type Selector -->
              <div class="form-group" style="margin-bottom:15px;">
                <label>Background Type</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button type="button" id="btnAppSolidColor" onclick="setAppBgType('color')"
                    style="flex:1;padding:10px;border:2px solid ${abg.useImage ? '#e1e1e1' : '#e94560'};border-radius:8px;background:${abg.useImage ? '#f8f9fa' : '#fff0f3'};cursor:pointer;font-weight:600;color:${abg.useImage ? '#666' : '#e94560'};">
                    Solid Color
                  </button>
                  <button type="button" id="btnAppBgImage" onclick="setAppBgType('image')"
                    style="flex:1;padding:10px;border:2px solid ${abg.useImage ? '#e94560' : '#e1e1e1'};border-radius:8px;background:${abg.useImage ? '#fff0f3' : '#f8f9fa'};cursor:pointer;font-weight:600;color:${abg.useImage ? '#e94560' : '#666'};">
                    Background Image
                  </button>
                </div>
                <input type="hidden" name="appBgUseImage" id="appBgUseImage" value="${abg.useImage ? 'true' : 'false'}">
              </div>

              <!-- Solid Color Section -->
              <div id="appSolidColorSection" style="display:${abg.useImage ? 'none' : 'block'};margin-bottom:15px;">
                <label>Background Color</label>
                <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
                  <input type="color" name="appBgColor" id="appBgColor" value="${abg.backgroundColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="appBgColorHex" style="font-family:monospace;color:#666;">${abg.backgroundColor || '#1a1a2e'}</span>
                </div>
              </div>

              <!-- Background Image Section -->
              <div id="appBgImageSection" style="display:${abg.useImage ? 'block' : 'none'};margin-bottom:15px;">
                ${abg.imageUrl ? `
                <div style="margin-bottom:12px;">
                  <label>Current Background</label>
                  <div style="position:relative;width:200px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #e1e1e1;margin-top:6px;">
                    <img src="${abg.imageUrl}" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                </div>
                ` : ''}
                <label>${abg.imageUrl ? 'Replace' : 'Upload'} Background Image</label>
                <small style="color:#666;display:block;margin-bottom:8px;">Recommended: 1920x1080 or larger. JPEG, PNG, GIF, or WebP.</small>
                <div id="appBgImageUploadArea" style="margin-top:8px;"></div>
              </div>
            </div>

            <!-- App Tint Overlay (only when image mode) -->
            <div id="appTintSection" style="display:${abg.useImage ? 'block' : 'none'};margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="appBgUseTint" value="${abg.useTint ? 'true' : 'false'}" id="appBgUseTintInput">
                  <div id="appTintToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${abg.useTint ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleAppTint()"></div>
                  <div id="appTintToggleThumb" style="position:absolute;height:20px;width:20px;left:${abg.useTint ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;font-weight:600;">Color Tint Overlay</span>
              </div>
              <div id="appTintControls" style="display:${abg.useTint ? 'block' : 'none'};">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                  <label style="margin-bottom:0;min-width:70px;">Tint Color</label>
                  <input type="color" name="appBgTintColor" id="appBgTintColor" value="${abg.tintColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="appTintColorHex" style="font-family:monospace;color:#666;">${abg.tintColor || '#1a1a2e'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <label style="margin-bottom:0;min-width:70px;">Opacity</label>
                  <input type="range" name="appBgTintOpacity" id="appBgTintOpacity" min="0" max="100" value="${Math.round((abg.tintOpacity ?? 0.5) * 100)}"
                    style="flex:1;" oninput="document.getElementById('appTintOpacityValue').textContent=this.value+'%'; updateAppPreview();">
                  <span id="appTintOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((abg.tintOpacity ?? 0.5) * 100)}%</span>
                </div>
              </div>
            </div>

            <!-- App Container Transparency -->
            <div style="margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">App Window Transparency</label>
              <small style="color:#666;display:block;margin-bottom:10px;">Controls how see-through the app window is (100% = fully solid, 0% = fully transparent)</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="range" name="appBgContainerOpacity" id="appBgContainerOpacity" min="0" max="100" value="${Math.round((abg.containerOpacity ?? 0.98) * 100)}"
                  style="flex:1;" oninput="document.getElementById('appContainerOpacityValue').textContent=this.value+'%'; updateAppPreview();">
                <span id="appContainerOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((abg.containerOpacity ?? 0.98) * 100)}%</span>
              </div>
            </div>

            <!-- App Live Preview -->
            <div style="margin-bottom:20px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Live Preview</label>
              <div id="appPreviewPanel" data-has-image="${abg.useImage && abg.imageUrl ? 'true' : 'false'}" style="position:relative;width:100%;max-width:400px;height:250px;border-radius:12px;overflow:hidden;border:2px solid #e1e1e1;${abg.useImage && abg.imageUrl ? `background:url('${abg.imageUrl}') center/cover no-repeat` : `background:${abg.backgroundColor || '#1a1a2e'}`};">
                <div id="appPreviewTint" style="position:absolute;top:0;left:0;width:100%;height:100%;background:${abg.tintColor || '#1a1a2e'};opacity:${abg.useImage && abg.useTint ? (abg.tintOpacity ?? 0.5) : 0};pointer-events:none;"></div>
                <div id="appPreviewCard" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;background:rgba(255,255,255,${abg.containerOpacity ?? 0.98});border-radius:10px;padding:15px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <div style="font-size:16px;">🏎️</div>
                    <div style="font-size:11px;font-weight:700;color:#1a1a2e;">Dashboard</div>
                    <div style="margin-left:auto;width:20px;height:20px;background:#e1e1e1;border-radius:50%;"></div>
                  </div>
                  <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <div style="flex:1;height:6px;background:linear-gradient(135deg,#e94560,#ff6b6b);border-radius:3px;"></div>
                    <div style="flex:1;height:6px;background:#e1e1e1;border-radius:3px;"></div>
                    <div style="flex:1;height:6px;background:#e1e1e1;border-radius:3px;"></div>
                  </div>
                  <div style="width:100%;height:8px;background:#f0f0f0;border-radius:3px;margin:4px 0;"></div>
                  <div style="width:70%;height:8px;background:#f0f0f0;border-radius:3px;margin:4px 0;"></div>
                </div>
              </div>
            </div>

            <button type="submit" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px;">Save Configuration</button>
          </form>

          <!-- Image upload/remove forms (outside main form to avoid nesting) -->
          <div id="bgImageUploadForm" style="display:${bg.useImage ? 'block' : 'none'};max-width:600px;margin-top:15px;">
            <form method="POST" action="/admin/upload-login-background" enctype="multipart/form-data" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <input type="file" name="backgroundImage" accept="image/jpeg,image/png,image/gif,image/webp"
                style="flex:1;min-width:200px;padding:8px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
              <button type="submit" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;">Upload Image</button>
            </form>
            ${bg.imageUrl ? `
            <form method="POST" action="/admin/remove-login-background" style="margin-top:8px;">
              <button type="submit" style="background:#e74c3c;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Remove Image</button>
            </form>
            ` : ''}
          </div>

          <!-- App background image upload/remove forms (outside main form) -->
          <div id="appBgImageUploadForm" style="display:${abg.useImage ? 'block' : 'none'};max-width:600px;margin-top:15px;">
            <form method="POST" action="/admin/upload-app-background" enctype="multipart/form-data" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <input type="file" name="appBackgroundImage" accept="image/jpeg,image/png,image/gif,image/webp"
                style="flex:1;min-width:200px;padding:8px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
              <button type="submit" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;">Upload Image</button>
            </form>
            ${abg.imageUrl ? `
            <form method="POST" action="/admin/remove-app-background" style="margin-top:8px;">
              <button type="submit" style="background:#e74c3c;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Remove Image</button>
            </form>
            ` : ''}
          </div>

          <div class="links" style="margin-top:20px;">
            <a href="/admin/dashboard">&larr; Back to Dashboard</a>
          </div>
        </div>
        <script>
          function validatePriceInput(el) {
            var val = el.value.replace(/[^0-9.]/g, '');
            var parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
            if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2);
            el.value = val;
          }
          function formatPriceBlur(el) {
            var num = parseFloat(el.value);
            if (!isNaN(num) && num >= 0) {
              el.value = num.toFixed(2);
            } else if (el.value === '') {
              el.value = '0.00';
            }
          }
          function toggleAnimatedLogin() {
            var input = document.getElementById('animatedLoginInput');
            var track = document.getElementById('toggleTrack');
            var thumb = document.getElementById('toggleThumb');
            var label = document.getElementById('toggleLabel');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            label.textContent = isOn ? 'Disabled Animated Login Experience' : 'Enabled Animated Login Experience';
          }
          function toggleChat() {
            var input = document.getElementById('chatEnabledInput');
            var track = document.getElementById('chatToggleTrack');
            var thumb = document.getElementById('chatToggleThumb');
            var label = document.getElementById('chatToggleLabel');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            label.textContent = isOn ? 'Disabled Group Chat' : 'Enabled Group Chat';
          }
          function setBgType(type) {
            var isImage = type === 'image';
            document.getElementById('loginBgUseImage').value = isImage ? 'true' : 'false';
            document.getElementById('solidColorSection').style.display = isImage ? 'none' : 'block';
            document.getElementById('bgImageSection').style.display = isImage ? 'block' : 'none';
            document.getElementById('bgImageUploadForm').style.display = isImage ? 'block' : 'none';
            document.getElementById('tintSection').style.display = isImage ? 'block' : 'none';
            var btnColor = document.getElementById('btnSolidColor');
            var btnImage = document.getElementById('btnBgImage');
            btnColor.style.borderColor = isImage ? '#e1e1e1' : '#e94560';
            btnColor.style.background = isImage ? '#f8f9fa' : '#fff0f3';
            btnColor.style.color = isImage ? '#666' : '#e94560';
            btnImage.style.borderColor = isImage ? '#e94560' : '#e1e1e1';
            btnImage.style.background = isImage ? '#fff0f3' : '#f8f9fa';
            btnImage.style.color = isImage ? '#e94560' : '#666';
            updatePreview();
          }
          function toggleTint() {
            var input = document.getElementById('loginBgUseTintInput');
            var track = document.getElementById('tintToggleTrack');
            var thumb = document.getElementById('tintToggleThumb');
            var controls = document.getElementById('tintControls');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            controls.style.display = isOn ? 'none' : 'block';
            updatePreview();
          }
          function updatePreview() {
            var panel = document.getElementById('previewPanel');
            var tint = document.getElementById('previewTint');
            var card = document.getElementById('previewCard');
            var isImage = document.getElementById('loginBgUseImage').value === 'true';
            var bgColor = document.getElementById('loginBgColor').value;
            var useTint = document.getElementById('loginBgUseTintInput').value === 'true';
            var tintColor = document.getElementById('loginBgTintColor').value;
            var tintOpacity = parseInt(document.getElementById('loginBgTintOpacity').value) / 100;
            var cardOpacity = parseInt(document.getElementById('loginBgCardOpacity').value) / 100;
            if (isImage && panel.dataset.hasImage === 'true') {
              // keep image background
            } else if (!isImage) {
              panel.style.backgroundImage = 'none';
              panel.style.backgroundColor = bgColor;
            }
            tint.style.background = tintColor;
            tint.style.opacity = (isImage && useTint) ? tintOpacity : 0;
            card.style.background = 'rgba(255,255,255,' + cardOpacity + ')';
          }
          document.getElementById('loginBgColor').addEventListener('input', function() {
            document.getElementById('loginBgColorHex').textContent = this.value;
            updatePreview();
          });
          document.getElementById('loginBgTintColor').addEventListener('input', function() {
            document.getElementById('tintColorHex').textContent = this.value;
            updatePreview();
          });
          // Move upload forms into the background image section (avoids nested forms)
          var uploadForm = document.getElementById('bgImageUploadForm');
          var uploadArea = document.getElementById('bgImageUploadArea');
          if (uploadForm && uploadArea) {
            uploadArea.appendChild(uploadForm);
          }
          // Move app background upload forms
          var appUploadForm = document.getElementById('appBgImageUploadForm');
          var appUploadArea = document.getElementById('appBgImageUploadArea');
          if (appUploadForm && appUploadArea) {
            appUploadArea.appendChild(appUploadForm);
          }
          // App Background functions
          function setAppBgType(type) {
            var isImage = type === 'image';
            document.getElementById('appBgUseImage').value = isImage ? 'true' : 'false';
            document.getElementById('appSolidColorSection').style.display = isImage ? 'none' : 'block';
            document.getElementById('appBgImageSection').style.display = isImage ? 'block' : 'none';
            document.getElementById('appBgImageUploadForm').style.display = isImage ? 'block' : 'none';
            document.getElementById('appTintSection').style.display = isImage ? 'block' : 'none';
            var btnColor = document.getElementById('btnAppSolidColor');
            var btnImage = document.getElementById('btnAppBgImage');
            btnColor.style.borderColor = isImage ? '#e1e1e1' : '#e94560';
            btnColor.style.background = isImage ? '#f8f9fa' : '#fff0f3';
            btnColor.style.color = isImage ? '#666' : '#e94560';
            btnImage.style.borderColor = isImage ? '#e94560' : '#e1e1e1';
            btnImage.style.background = isImage ? '#fff0f3' : '#f8f9fa';
            btnImage.style.color = isImage ? '#e94560' : '#666';
            updateAppPreview();
          }
          function toggleAppTint() {
            var input = document.getElementById('appBgUseTintInput');
            var track = document.getElementById('appTintToggleTrack');
            var thumb = document.getElementById('appTintToggleThumb');
            var controls = document.getElementById('appTintControls');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            controls.style.display = isOn ? 'none' : 'block';
            updateAppPreview();
          }
          function updateAppPreview() {
            var panel = document.getElementById('appPreviewPanel');
            var tint = document.getElementById('appPreviewTint');
            var card = document.getElementById('appPreviewCard');
            var isImage = document.getElementById('appBgUseImage').value === 'true';
            var bgColor = document.getElementById('appBgColor').value;
            var useTint = document.getElementById('appBgUseTintInput').value === 'true';
            var tintColor = document.getElementById('appBgTintColor').value;
            var tintOpacity = parseInt(document.getElementById('appBgTintOpacity').value) / 100;
            var containerOpacity = parseInt(document.getElementById('appBgContainerOpacity').value) / 100;
            if (isImage && panel.dataset.hasImage === 'true') {
              // keep image background
            } else if (!isImage) {
              panel.style.backgroundImage = 'none';
              panel.style.backgroundColor = bgColor;
            }
            tint.style.background = tintColor;
            tint.style.opacity = (isImage && useTint) ? tintOpacity : 0;
            card.style.background = 'rgba(255,255,255,' + containerOpacity + ')';
          }
          document.getElementById('appBgColor').addEventListener('input', function() {
            document.getElementById('appBgColorHex').textContent = this.value;
            updateAppPreview();
          });
          document.getElementById('appBgTintColor').addEventListener('input', function() {
            document.getElementById('appTintColorHex').textContent = this.value;
            updateAppPreview();
          });
        </script>
      </body>
      </html>
    `);
  });

  // Save app config
  router.post('/app-config', requireAdmin, (req, res) => {
    const { appTitle, appSubtitle, defaultRegistrationPrice, defaultMinScore, defaultMaxScore, animatedLogin, chatEnabled,
            loginBgUseImage, loginBgColor, loginBgUseTint, loginBgTintColor, loginBgTintOpacity, loginBgCardOpacity,
            appBgUseImage, appBgColor, appBgUseTint, appBgTintColor, appBgTintOpacity, appBgContainerOpacity } = req.body;

    if (!/^\d+(\.\d{1,2})?$/.test((defaultRegistrationPrice || '').trim())) {
      return res.send(errorPage('Invalid price. Enter a number like 25 or 25.00.', '/admin/app-config', 'Try Again'));
    }

    if (!/^\d+$/.test((defaultMinScore || '').trim()) || !/^\d+$/.test((defaultMaxScore || '').trim())) {
      return res.send(errorPage('Default Min Score and Max Score must be whole numbers.', '/admin/app-config', 'Try Again'));
    }

    appConfig.appTitle = appTitle || 'Car Show Manager';
    appConfig.appSubtitle = appSubtitle || '';
    appConfig.defaultRegistrationPrice = Math.round((parseFloat(defaultRegistrationPrice) || 25.00) * 100) / 100;
    appConfig.defaultMinScore = parseInt(defaultMinScore) || 0;
    appConfig.defaultMaxScore = parseInt(defaultMaxScore) || 10;
    appConfig.animatedLogin = animatedLogin === 'true';
    appConfig.chatEnabled = chatEnabled === 'true';

    // Update loginBackground settings (preserve imageUrl — only changed by upload/remove routes)
    if (!appConfig.loginBackground) appConfig.loginBackground = {};
    appConfig.loginBackground.useImage = loginBgUseImage === 'true';
    appConfig.loginBackground.backgroundColor = /^#[0-9A-Fa-f]{6}$/.test(loginBgColor) ? loginBgColor : '#1a1a2e';
    appConfig.loginBackground.useTint = loginBgUseTint === 'true';
    appConfig.loginBackground.tintColor = /^#[0-9A-Fa-f]{6}$/.test(loginBgTintColor) ? loginBgTintColor : '#1a1a2e';
    appConfig.loginBackground.tintOpacity = Math.max(0, Math.min(1, (parseInt(loginBgTintOpacity) || 50) / 100));
    appConfig.loginBackground.cardOpacity = Math.max(0, Math.min(1, (parseInt(loginBgCardOpacity) || 98) / 100));

    // Update appBackground settings (preserve imageUrl — only changed by upload/remove routes)
    if (!appConfig.appBackground) appConfig.appBackground = {};
    appConfig.appBackground.useImage = appBgUseImage === 'true';
    appConfig.appBackground.backgroundColor = /^#[0-9A-Fa-f]{6}$/.test(appBgColor) ? appBgColor : '#1a1a2e';
    appConfig.appBackground.useTint = appBgUseTint === 'true';
    appConfig.appBackground.tintColor = /^#[0-9A-Fa-f]{6}$/.test(appBgTintColor) ? appBgTintColor : '#1a1a2e';
    appConfig.appBackground.tintOpacity = Math.max(0, Math.min(1, (parseInt(appBgTintOpacity) || 50) / 100));
    appConfig.appBackground.containerOpacity = Math.max(0, Math.min(1, (parseInt(appBgContainerOpacity) || 98) / 100));

    saveConfig();

    res.redirect('/admin/app-config?saved=1');
  });

  return router;
};
