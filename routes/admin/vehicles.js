// routes/admin/vehicles.js - Vehicle management routes for admin
const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../../middleware/auth');
const { handleVehiclePhotoUpload, deleteVehicleImage } = require('../../helpers/imageUpload');
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

module.exports = function(db, appConfig, upload) {
  const router = express.Router();

  // ============================================================
  // Vehicle List Page
  // ============================================================
  router.get('/vehicles', requireAdmin, (req, res) => {
    const user = req.session.user;

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
          ${getAppBgStyles(appConfig)}
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
        ${getBodyTag(req, appConfig)}
          <div class="container dashboard-container">
            ${adminHeader(user)}

            ${getAdminNav('vehicles', isChatEnabled(appConfig, user))}

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
              ${getAppBgStyles(appConfig)}
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
            ${getBodyTag(req, appConfig)}
              <div class="container dashboard-container">
                ${adminHeader(user)}

                ${getAdminNav('vehicles', isChatEnabled(appConfig, user))}

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
        const result = await handleVehiclePhotoUpload(req.file);
        if (result.success) {
          // Delete old image if exists
          deleteVehicleImage(car.image_url);
          imageUrl = result.imageUrl;
        } else {
          console.error('Error processing image:', result.error);
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Update Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            ${getBodyTag(req, appConfig)}
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
                ${getBodyTag(req, appConfig)}
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
              ${getBodyTag(req, appConfig)}
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
          deleteVehicleImage(car.image_url);
        }
        res.redirect('/admin/vehicles');
      });
    });
  });

  return router;
};
