// routes/adminConfig/classes.js - Class management routes
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Classes management page (legacy - NOT USED, may redirect)
  router.get('/classes', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

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
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

              <h3 class="section-title">Vehicle Classes</h3>
              <p style="color:var(--text-secondary);margin-bottom:15px;">Define classes like Street Rod, Muscle Car, Custom, etc.</p>

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

              <div class="table-wrapper config-table">
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
                    ${rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No classes defined yet.</td></tr>'}
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
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

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
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

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

  return router;
};
