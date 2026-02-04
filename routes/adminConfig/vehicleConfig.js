// routes/adminConfig/vehicleConfig.js - Vehicle types configuration routes
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Vehicle config hub page (combined vehicle types + classes)
  router.get('/vehicle-config', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

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
                ${getAppBgStyles(appConfig)}
              </head>
              ${getBodyTag(req)}
                <div class="container dashboard-container">
                  ${adminHeader(user)}
                  ${getAdminNav('config', chatEnabled)}

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
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

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
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

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
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

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
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

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

  return router;
};
