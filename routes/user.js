// routes/user.js - User dashboard, vehicle registration/edit/delete, and voting routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth } = require('../middleware/auth');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getAvatarContent, getNav, dashboardHeader } = require('../views/components');
  const { handleVehiclePhotoUpload, deleteVehicleImage } = require('../helpers/imageUpload');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => `<body data-user-role="${req.session && req.session.user ? req.session.user.role : ''}">`;

  router.get('/', requireAuth, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get user's registered vehicles (both active and pending) with class names
    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.is_active, c.voter_id,
            cl.class_name, v.vehicle_name, v.registration_price
            FROM cars c
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.user_id = ? ORDER BY c.created_at DESC`, [user.user_id], (err, cars) => {
      if (err) {
        cars = [];
      }

      const vehicleCards = cars.length > 0 ? cars.map(car => `
        <div class="vehicle-card ${car.is_active ? '' : 'pending'}">
          <div class="vehicle-image" ${car.image_url ? `onclick="openImageModal('${car.image_url}', '${car.year ? car.year + ' ' : ''}${car.make} ${car.model}')"` : ''}>
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
              ${car.is_active ? '' : '<span class="status-badge pending">Pending Approval</span>'}
              ${car.is_active && car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
            </div>
            ${!car.is_active && car.registration_price != null ? `<div class="registration-fee">Registration Fee: $${parseFloat(car.registration_price).toFixed(2)}</div>` : ''}
            ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
          </div>
          <div class="vehicle-actions">
            <a href="/user/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
          </div>
        </div>
      `).join('') : '<p style="color: #666; text-align: center; padding: 20px;">You haven\'t registered any vehicles yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>My Account - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
          <style>
            .vehicle-card {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 12px;
              margin-bottom: 12px;
              border: 1px solid #e1e1e1;
              display: flex;
              flex-direction: row;
              gap: 12px;
              align-items: flex-start;
            }
            .vehicle-image {
              width: 100px;
              height: 75px;
              border-radius: 8px;
              overflow: hidden;
              background: #e1e1e1;
              flex-shrink: 0;
              cursor: pointer;
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
              font-size: 32px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
            .vehicle-info {
              flex: 1;
              min-width: 0;
            }
            .vehicle-title {
              font-size: 16px;
              font-weight: 700;
              color: #1a1a2e;
              margin-bottom: 6px;
            }
            .vehicle-class {
              margin-bottom: 6px;
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }
            .type-badge {
              background: #3498db;
              color: white;
              padding: 3px 8px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
            }
            .class-badge {
              background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
              color: white;
              padding: 3px 8px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
            }
            .voter-badge {
              background: #9b59b6;
              color: white;
              padding: 3px 8px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
            }
            .registration-fee {
              font-size: 14px;
              color: #000;
              font-weight: 700;
              margin-top: 4px;
            }
            .vehicle-description {
              font-size: 12px;
              color: #666;
              line-height: 1.3;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .vehicle-actions {
              display: flex;
              flex-direction: column;
              gap: 6px;
              flex-shrink: 0;
            }
            .vehicle-actions .action-btn {
              font-size: 12px;
              padding: 6px 12px;
            }
            .register-btn {
              display: block;
              width: 100%;
              padding: 16px;
              background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
              color: white;
              text-align: center;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              margin-top: 20px;
            }
            .register-btn:active {
              opacity: 0.9;
              transform: scale(0.98);
            }
            .vehicle-card.pending {
              opacity: 0.7;
              border-style: dashed;
            }
            .status-badge.pending {
              background: #f39c12;
              color: white;
              padding: 3px 8px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
            }
            /* Fullscreen image modal */
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
            .image-modal-close:hover {
              background: rgba(255, 255, 255, 0.3);
            }
            @media (min-width: 768px) {
              .vehicle-card {
                padding: 16px;
                align-items: center;
              }
              .vehicle-image {
                width: 200px;
                height: 120px;
              }
              .vehicle-title {
                font-size: 18px;
              }
              .vehicle-placeholder {
                font-size: 48px;
              }
              .type-badge, .class-badge, .status-badge.pending {
                font-size: 12px;
                padding: 4px 12px;
              }
              .vehicle-description {
                font-size: 14px;
              }
              .vehicle-actions {
                flex-direction: row;
              }
              .vehicle-actions .action-btn {
                font-size: 14px;
                padding: 8px 16px;
              }
              .register-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(39, 174, 96, 0.4);
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Show Manager</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="welcome-card">
              <h2>Welcome, ${user.name}!</h2>
              <p>Manage your registered vehicles for the car show.</p>
            </div>

            <div class="admin-nav">
              <a href="/user" class="active">Dashboard</a>
              <a href="/user/vehicles">Vehicles</a>
              <a href="/user/vendors">Vendors</a>
              <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">My Registered Vehicles (${cars.length})</h3>

            ${vehicleCards}

            <a href="/user/register-vehicle" class="register-btn">+ Register New Vehicle</a>
          </div>

          <!-- Fullscreen Image Modal -->
          <div class="image-modal" id="imageModal" onclick="closeImageModal()">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <img id="modalImage" src="" alt="">
          </div>

          <script>
            function openImageModal(src, alt) {
              const modal = document.getElementById('imageModal');
              const img = document.getElementById('modalImage');
              img.src = src;
              img.alt = alt;
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }

            function closeImageModal() {
              const modal = document.getElementById('imageModal');
              modal.classList.remove('active');
              document.body.style.overflow = '';
            }

            // Close modal with Escape key
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            });
          </script>
        </body>
        </html>
      `);
    });
  });

  router.get('/register-vehicle', requireAuth, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
          `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
        ).join('');

        // Group classes by vehicle type for the JavaScript
        const classesJson = JSON.stringify(classes);

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Register Vehicle - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
            <style>
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
                transition: all 0.2s ease;
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
                box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Show Manager</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/user">Dashboard</a>
                <a href="/user/vehicles">Vehicles</a>
                <a href="/user/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
                <a href="/user/profile">My Profile</a>
              </div>

              <h3 class="section-title">Register New Vehicle</h3>

              ${vehicleTypes.length === 0 ? '<div class="error-message">No vehicle types are available. Please contact the administrator.</div>' : ''}

              <form method="POST" action="/user/register-vehicle" enctype="multipart/form-data">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Year (Optional)</label>
                    <input type="text" name="year" inputmode="numeric" maxlength="4" placeholder="e.g., 1969" style="font-size:16px;width:120px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                  </div>
                  <div class="form-group">
                    <label>Make *</label>
                    <input type="text" name="make" required placeholder="e.g., Ford, Chevrolet, Toyota">
                  </div>
                  <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" required placeholder="e.g., Mustang, Camaro, Supra">
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
                      <option value="">Select vehicle type first...</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description (Optional)</label>
                    <textarea name="description" placeholder="Tell us about your vehicle... year, special features, history, etc."></textarea>
                  </div>
                  <div class="form-group">
                    <label>Vehicle Photo (Optional)</label>
                    <div class="file-input-wrapper" id="fileWrapper">
                      <div class="file-input-label">
                        Click or tap to select an image<br>
                        <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                      </div>
                      <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                    </div>
                    <div class="file-name" id="fileName"></div>
                    <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin:10px auto 0;border-radius:8px;border:2px solid #e1e1e1;">
                  </div>
                  <button type="submit">Register Vehicle</button>
                </div>
              </form>

              <div class="links" style="margin-top:20px;">
                <a href="/user">&larr; Back to Dashboard</a>
              </div>
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

  // Handle vehicle registration
  router.post('/register-vehicle', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
    const user = req.session.user;
    const { year, make, model, vehicle_id, class_id, description } = req.body;

    if (year && !/^\d{4}$/.test(year.trim())) {
      return res.send(errorPage('Year must be a 4-digit number.', '/user/register-vehicle', 'Try Again'));
    }

    let imageUrl = null;

    // Process image if uploaded
    if (req.file) {
      const result = await handleVehiclePhotoUpload(req.file);
      if (!result.success) {
        return res.send(errorPage('Error processing image. Please try a different file.', '/user/register-vehicle', 'Try Again'));
      }
      imageUrl = result.imageUrl;
    }

    // Insert vehicle into database - is_active=0 by default until registrar enables after payment
    db.run('INSERT INTO cars (year, make, model, vehicle_id, class_id, description, image_url, user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [year ? year.trim() : null, make, model, vehicle_id, class_id, description || null, imageUrl, user.user_id],
      function(err) {
        if (err) {
          console.error('Vehicle registration error:', err.message);
          res.send(errorPage('Error registering vehicle. Please try again.', '/user/register-vehicle', 'Try Again'));
        } else {
          res.send(successPage(`Your ${make} ${model} has been registered successfully!`, '/user', 'Back to My Vehicles'));
        }
      });
  });

  // Edit vehicle page
  router.get('/edit-vehicle/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get the vehicle with its current vehicle_id and class_id
    db.get('SELECT car_id, year, make, model, vehicle_id, class_id, description, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
      if (err || !car) {
        res.redirect('/user');
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
              <title>Edit Vehicle - Car Show Manager</title>
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
                  transition: all 0.2s ease;
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
                  box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
                }
                .delete-btn {
                  display: block;
                  width: 100%;
                  padding: 16px;
                  background: #e74c3c;
                  color: white;
                  text-align: center;
                  text-decoration: none;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 16px;
                  margin-top: 10px;
                  border: none;
                  cursor: pointer;
                }
                .delete-btn:active {
                  opacity: 0.9;
                }
              </style>
            </head>
            ${bodyTag(req)}
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Car Show Manager</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/user">Dashboard</a>
                  <a href="/user/vehicles">Vehicles</a>
                  <a href="/user/vendors">Vendors</a>
                  <a href="/user/vote">Vote Here!</a>
                  <a href="/user/profile">My Profile</a>
                </div>

                <h3 class="section-title">Edit Vehicle: ${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h3>

                <form method="POST" action="/user/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
                  <div class="profile-card">
                    <div class="form-group">
                      <label>Year (Optional)</label>
                      <input type="text" name="year" inputmode="numeric" maxlength="4" placeholder="e.g., 1969" value="${car.year || ''}" style="font-size:16px;width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
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
                      <label>Description (Optional)</label>
                      <textarea name="description" placeholder="Tell us about your vehicle...">${car.description || ''}</textarea>
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

                <form method="POST" action="/user/delete-vehicle/${car.car_id}" onsubmit="return confirm('Are you sure you want to remove this vehicle from the show?');">
                  <button type="submit" class="delete-btn">Remove Vehicle</button>
                </form>

                <div class="links" style="margin-top:20px;">
                  <a href="/user">&larr; Back to Dashboard</a>
                </div>

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

  // Handle vehicle update
  router.post('/edit-vehicle/:id', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const { year, make, model, vehicle_id, class_id, description } = req.body;

    if (year && !/^\d{4}$/.test(year.trim())) {
      return res.send(errorPage('Year must be a 4-digit number.', `/user/edit-vehicle/${carId}`, 'Try Again'));
    }

    // First verify the car belongs to this user (include pending vehicles)
    db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], async (err, car) => {
      if (err || !car) {
        res.redirect('/user');
        return;
      }

      let imageUrl = car.image_url;

      // Process new image if uploaded
      if (req.file) {
        const result = await handleVehiclePhotoUpload(req.file);
        if (!result.success) {
          return res.send(errorPage('Error processing image. Please try a different file.', `/user/edit-vehicle/${carId}`, 'Try Again'));
        }
        deleteVehicleImage(car.image_url);
        imageUrl = result.imageUrl;
      }

      // Update vehicle in database
      db.run('UPDATE cars SET year = ?, make = ?, model = ?, vehicle_id = ?, class_id = ?, description = ?, image_url = ? WHERE car_id = ? AND user_id = ?',
        [year ? year.trim() : null, make, model, vehicle_id, class_id, description || null, imageUrl, carId, user.user_id],
        function(err) {
          if (err) {
            console.error('Vehicle update error:', err.message);
            res.send(errorPage('Error updating vehicle. Please try again.', `/user/edit-vehicle/${carId}`, 'Try Again'));
          } else {
            res.send(successPage(`Your ${make} ${model} has been updated successfully!`, '/user', 'Back to My Vehicles'));
          }
        });
    });
  });

  // Handle vehicle deletion (hard delete for users)
  router.post('/delete-vehicle/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;

    // First get the vehicle to delete its image
    db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
      if (err || !car) {
        res.redirect('/user');
        return;
      }

      // Delete the vehicle
      db.run('DELETE FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], function(err) {
        if (err) {
          console.error('Vehicle deletion error:', err.message);
          res.send(errorPage('Error removing vehicle. Please try again.', '/user', 'Back to My Vehicles'));
        } else {
          deleteVehicleImage(car.image_url);
          res.send(successPage('Vehicle has been deleted.', '/user', 'Back to My Vehicles'));
        }
      });
    });
  });

  // ==========================================
  // USER VEHICLES BROWSING ROUTES
  // ==========================================

  // Vehicles list - all active/registered vehicles
  router.get('/vehicles', requireAuth, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.image_url,
            u.username as owner_username
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            WHERE c.is_active = 1
            ORDER BY c.voter_id, c.make, c.model`, (err, cars) => {
      if (err) cars = [];

      const vehicleCards = cars.length > 0 ? cars.map(car => `
        <a href="/user/view-vehicle/${car.car_id}" class="vehicle-browse-card">
          <div class="vehicle-browse-image" ${car.image_url ? `onclick="openImageModal('${car.image_url}', '${car.year ? car.year + ' ' : ''}${car.make} ${car.model}'); event.preventDefault(); event.stopPropagation();"` : ''}>
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.year ? car.year + ' ' : ''}${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-browse-info">
            <div class="vehicle-browse-title">${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</div>
            <div class="vehicle-browse-owner">Owner: @${car.owner_username || 'N/A'}</div>
          </div>
        </a>
      `).join('') : '<p style="color: #666; text-align: center; padding: 20px;">No registered vehicles yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vehicles - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
          <style>
            .vehicle-browse-card {
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
            .vehicle-browse-card:active {
              background: #eef;
            }
            .vehicle-browse-image {
              width: 100px;
              height: 75px;
              border-radius: 8px;
              overflow: hidden;
              background: #e1e1e1;
              flex-shrink: 0;
              cursor: pointer;
            }
            .vehicle-browse-image img {
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
              font-size: 32px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
            .vehicle-browse-info {
              flex: 1;
              min-width: 0;
            }
            .vehicle-browse-title {
              font-size: 16px;
              font-weight: 700;
              color: #1a1a2e;
            }
            .vehicle-browse-owner {
              font-size: 13px;
              color: #888;
              margin-top: 4px;
            }
            /* Fullscreen image modal */
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
            .image-modal-close:hover {
              background: rgba(255, 255, 255, 0.3);
            }
            @media (min-width: 768px) {
              .vehicle-browse-card {
                padding: 16px;
              }
              .vehicle-browse-card:hover {
                border-color: #e94560;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
              }
              .vehicle-browse-image {
                width: 200px;
                height: 120px;
              }
              .vehicle-browse-title {
                font-size: 18px;
              }
              .vehicle-placeholder {
                font-size: 48px;
              }
            }
          </style>
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            ${dashboardHeader('user', user, 'Car Show Manager')}

            ${getNav('user', 'vehicles')}

            <h3 class="section-title">Registered Vehicles (${cars.length})</h3>

            ${vehicleCards}
          </div>

          <!-- Fullscreen Image Modal -->
          <div class="image-modal" id="imageModal" onclick="closeImageModal()">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <img id="modalImage" src="" alt="">
          </div>

          <script>
            function openImageModal(src, alt) {
              const modal = document.getElementById('imageModal');
              const img = document.getElementById('modalImage');
              img.src = src;
              img.alt = alt;
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }

            function closeImageModal() {
              const modal = document.getElementById('imageModal');
              modal.classList.remove('active');
              document.body.style.overflow = '';
            }

            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            });
          </script>
        </body>
        </html>
      `);
    });
  });

  // View vehicle detail - public vehicle info (no personal data)
  router.get('/view-vehicle/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const avatarContent = getAvatarContent(user);

    db.get(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id,
            u.username as owner_username,
            cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.car_id = ? AND c.is_active = 1`, [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/user/vehicles');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vehicle Details - Car Show Manager</title>
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
              background: #e1e1e1;
              margin-bottom: 20px;
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
              margin-bottom: 20px;
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
              text-align: right;
              max-width: 60%;
            }
            .description-section {
              background: #f8f9fa;
              padding: 16px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .description-section h4 {
              color: #1a1a2e;
              margin-bottom: 8px;
            }
            .description-section p {
              color: #666;
              font-size: 14px;
              line-height: 1.5;
            }
            /* Fullscreen image modal */
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
            .image-modal-close:hover {
              background: rgba(255, 255, 255, 0.3);
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
            ${dashboardHeader('user', user, 'Car Show Manager')}

            ${getNav('user', 'vehicles')}

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
                <span class="detail-label">Class</span>
                <span class="detail-value">${car.class_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Registration Number</span>
                <span class="detail-value">${car.voter_id ? '#' + car.voter_id : 'Not assigned'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Owner</span>
                <span class="detail-value">@${car.owner_username || 'N/A'}</span>
              </div>
            </div>

            ${car.description ? `
              <div class="description-section">
                <h4>Description</h4>
                <p>${car.description}</p>
              </div>
            ` : ''}

            <div class="links" style="margin-top:20px;">
              <a href="/user/vehicles">&larr; Back to Vehicles</a>
            </div>
          </div>

          <!-- Fullscreen Image Modal -->
          <div class="image-modal" id="imageModal" onclick="closeImageModal()">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <img id="modalImage" src="" alt="">
          </div>

          <script>
            function openImageModal(src, alt) {
              const modal = document.getElementById('imageModal');
              const img = document.getElementById('modalImage');
              img.src = src;
              img.alt = alt;
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }

            function closeImageModal() {
              const modal = document.getElementById('imageModal');
              modal.classList.remove('active');
              document.body.style.overflow = '';
            }

            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            });
          </script>
        </body>
        </html>
      `);
    });
  });

  // ==========================================
  // USER SPECIALTY VOTING ROUTES
  // ==========================================

  // User voting page - shows available specialty votes
  router.get('/vote', requireAuth, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Find all specialty votes this user can participate in
    // Either allow_all_users=1 OR user is in specialty_vote_voters
    db.all(`
      SELECT DISTINCT sv.specialty_vote_id, sv.vote_name, sv.description
      FROM specialty_votes sv
      LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id
      WHERE sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id = ?)
      ORDER BY sv.vote_name
    `, [user.user_id], (err, availableVotes) => {
      if (err) availableVotes = [];

      // Check which votes the user has already voted in
      db.all('SELECT specialty_vote_id FROM specialty_vote_results WHERE user_id = ?', [user.user_id], (err, completedVotes) => {
        const completedVoteIds = new Set((completedVotes || []).map(v => v.specialty_vote_id));

        // Separate into available and completed
        const pendingVotes = availableVotes.filter(v => !completedVoteIds.has(v.specialty_vote_id));
        const alreadyVoted = availableVotes.filter(v => completedVoteIds.has(v.specialty_vote_id));

        const voteOptions = pendingVotes.length > 0 ? pendingVotes.map(v => `
          <option value="${v.specialty_vote_id}">${v.vote_name}${v.description ? ' - ' + v.description : ''}</option>
        `).join('') : '';

        const completedList = alreadyVoted.length > 0 ? alreadyVoted.map(v => `
          <div style="background:#d4edda;color:#155724;padding:10px;border-radius:8px;margin-bottom:8px;">
            <strong>${v.vote_name}</strong> - You have already voted
          </div>
        `).join('') : '';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vote Here! - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
            <style>
              .vote-select-card {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid #e1e1e1;
              }
              .vote-btn {
                display: block;
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                color: white;
                text-align: center;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                border: none;
                cursor: pointer;
                margin-top: 15px;
              }
              .vote-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
              }
              .no-votes-message {
                text-align: center;
                padding: 40px 20px;
                color: #666;
              }
              .no-votes-message .icon {
                font-size: 48px;
                margin-bottom: 15px;
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              ${dashboardHeader(user.role, user, user.role === 'admin' ? 'Admin Dashboard' : user.role === 'judge' ? 'Judge Dashboard' : user.role === 'registrar' ? 'Registrar' : 'Car Show Manager')}

              <div class="welcome-card">
                <h2>Vote Here!</h2>
                <p>Participate in specialty voting for the car show.</p>
              </div>

              ${getNav(user.role, 'vote')}

              ${appConfig.specialtyVotingStatus === 'Lock' ? `
                <div class="no-votes-message">
                  <div class="icon">🔒</div>
                  <h3>Voting is Locked</h3>
                  <p>Specialty voting has been locked by the administrator. Results will be announced soon.</p>
                </div>
              ` : appConfig.specialtyVotingStatus === 'Close' ? `
                <div class="no-votes-message">
                  <div class="icon">🚫</div>
                  <h3>Voting is not open yet</h3>
                  <p>Contact the administrator to open voting.</p>
                </div>
              ` : pendingVotes.length > 0 ? `
                <div class="vote-select-card">
                  <h3 style="margin-bottom:15px;">Select a Vote to Participate In</h3>
                  <form action="/user/vote/select" method="POST">
                    <div class="form-group">
                      <label>Available Votes</label>
                      <select name="specialty_vote_id" required>
                        <option value="">Choose a vote...</option>
                        ${voteOptions}
                      </select>
                    </div>
                    <button type="submit" class="vote-btn">Start Voting</button>
                  </form>
                </div>
              ` : `
                <div class="no-votes-message">
                  <div class="icon">🗳️</div>
                  <h3>Not Currently Active</h3>
                  <p>You are not currently part of any active specialty votes, or you have already voted in all available categories.</p>
                </div>
              `}

              ${completedList ? `
                <h3 class="section-title" style="margin-top:30px;">Completed Votes</h3>
                ${completedList}
              ` : ''}
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Handle vote selection - redirect to vehicle voting page
  router.post('/vote/select', requireAuth, (req, res) => {
    const specialtyVoteId = req.body.specialty_vote_id;
    res.redirect(`/user/vote/${specialtyVoteId}`);
  });

  // Vehicle voting page - shows all registered vehicles for a specific specialty vote
  router.get('/vote/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const specialtyVoteId = req.params.id;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // First verify the user can participate in this vote
    db.get(`
      SELECT sv.specialty_vote_id, sv.vote_name, sv.description, sv.allow_all_users, sv.vehicle_id, sv.class_id
      FROM specialty_votes sv
      LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id AND svv.user_id = ?
      WHERE sv.specialty_vote_id = ? AND sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id IS NOT NULL)
    `, [user.user_id, specialtyVoteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/user/vote');
        return;
      }

      // Check if user has already voted
      db.get('SELECT id FROM specialty_vote_results WHERE specialty_vote_id = ? AND user_id = ?',
        [specialtyVoteId, user.user_id], (err, existingVote) => {
        if (existingVote) {
          res.redirect('/user/vote');
          return;
        }

        // Build car query with optional vehicle type and class filters
        let carQuery = `
          SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id,
                 u.name as owner_name,
                 cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          WHERE c.is_active = 1`;
        const carParams = [];
        if (vote.vehicle_id) {
          carQuery += ' AND c.vehicle_id = ?';
          carParams.push(vote.vehicle_id);
        }
        if (vote.class_id) {
          carQuery += ' AND c.class_id = ?';
          carParams.push(vote.class_id);
        }
        carQuery += ' ORDER BY c.voter_id, c.make, c.model';

        // Get filtered active registered vehicles
        db.all(carQuery, carParams, (err, cars) => {
          if (err) cars = [];

          const vehicleCards = cars.length > 0 ? cars.map(car => `
            <label class="vehicle-vote-card">
              <input type="radio" name="car_id" value="${car.car_id}" required>
              <div class="vehicle-vote-content">
                <div class="vehicle-vote-image">
                  ${car.image_url
                    ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" onclick="openImageModal('${car.image_url}', '${car.year || ''} ${car.make} ${car.model}'); event.preventDefault();">`
                    : `<div class="vehicle-placeholder">🚗</div>`
                  }
                </div>
                <div class="vehicle-vote-info">
                  <div class="vehicle-vote-title">
                    ${car.voter_id ? `<span class="voter-badge">Registration: ${car.voter_id}</span>` : ''}
                    ${car.year || ''} ${car.make} ${car.model}
                  </div>
                  <div class="vehicle-vote-details">
                    ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                    ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                  </div>
                  ${car.description ? `<div class="vehicle-vote-desc">${car.description}</div>` : ''}
                  <div class="vehicle-vote-owner">Owner: ${car.owner_name || 'Unknown'}</div>
                </div>
                <div class="vehicle-vote-check">
                  <span class="checkmark"></span>
                </div>
              </div>
            </label>
          `).join('') : '<p style="text-align:center;color:#666;padding:20px;">No vehicles are currently registered.</p>';

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${vote.vote_name} - Car Show Manager</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
        ${appBgStyles()}
              <style>
                .vote-header {
                  background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                  color: white;
                  padding: 20px;
                  border-radius: 12px;
                  margin-bottom: 20px;
                  text-align: center;
                }
                .vote-header h2 {
                  color: white;
                  margin-bottom: 5px;
                }
                .vehicle-vote-card {
                  display: block;
                  background: #f8f9fa;
                  border-radius: 12px;
                  margin-bottom: 12px;
                  border: 2px solid #e1e1e1;
                  cursor: pointer;
                  transition: all 0.2s ease;
                }
                .vehicle-vote-card:hover {
                  border-color: #e94560;
                }
                .vehicle-vote-card input[type="radio"] {
                  display: none;
                }
                .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content {
                  border-color: #e94560;
                  background: #fff5f7;
                }
                .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content .checkmark {
                  background: #e94560;
                  border-color: #e94560;
                }
                .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content .checkmark::after {
                  display: block;
                }
                .vehicle-vote-content {
                  display: flex;
                  padding: 12px;
                  gap: 12px;
                  align-items: center;
                  border-radius: 10px;
                  border: 2px solid transparent;
                }
                .vehicle-vote-image {
                  width: 80px;
                  height: 60px;
                  border-radius: 8px;
                  overflow: hidden;
                  background: #e1e1e1;
                  flex-shrink: 0;
                }
                .vehicle-vote-image img {
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                  cursor: zoom-in;
                }
                .vehicle-placeholder {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24px;
                  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                }
                .vehicle-vote-info {
                  flex: 1;
                  min-width: 0;
                }
                .vehicle-vote-title {
                  font-weight: 700;
                  font-size: 14px;
                  color: #1a1a2e;
                  margin-bottom: 4px;
                }
                .vehicle-vote-details {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 4px;
                  margin-bottom: 4px;
                }
                .vehicle-vote-desc {
                  font-size: 11px;
                  color: #666;
                  display: -webkit-box;
                  -webkit-line-clamp: 1;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                .vehicle-vote-owner {
                  font-size: 11px;
                  color: #888;
                  margin-top: 2px;
                }
                .vehicle-vote-check {
                  flex-shrink: 0;
                }
                .checkmark {
                  display: block;
                  width: 24px;
                  height: 24px;
                  border: 2px solid #ccc;
                  border-radius: 50%;
                  position: relative;
                }
                .checkmark::after {
                  content: '';
                  display: none;
                  position: absolute;
                  left: 7px;
                  top: 3px;
                  width: 6px;
                  height: 12px;
                  border: solid white;
                  border-width: 0 2px 2px 0;
                  transform: rotate(45deg);
                }
                .voter-badge {
                  background: #2c3e50;
                  color: white;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 600;
                  margin-right: 6px;
                }
                .type-badge {
                  background: #3498db;
                  color: white;
                  padding: 2px 6px;
                  border-radius: 10px;
                  font-size: 10px;
                  font-weight: 600;
                }
                .class-badge {
                  background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                  color: white;
                  padding: 2px 6px;
                  border-radius: 10px;
                  font-size: 10px;
                  font-weight: 600;
                }
                .submit-vote-btn {
                  display: block;
                  width: 100%;
                  padding: 18px;
                  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                  color: white;
                  text-align: center;
                  border: none;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 18px;
                  cursor: pointer;
                  margin-top: 20px;
                  position: sticky;
                  bottom: 20px;
                }
                .submit-vote-btn:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 10px 30px rgba(39, 174, 96, 0.4);
                }
                .back-link {
                  display: block;
                  text-align: center;
                  margin-top: 15px;
                  color: #666;
                }
                /* Fullscreen image modal */
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
                }
                @media (min-width: 768px) {
                  .vehicle-vote-image {
                    width: 120px;
                    height: 80px;
                  }
                  .vehicle-vote-title {
                    font-size: 16px;
                  }
                  .type-badge, .class-badge {
                    font-size: 12px;
                    padding: 3px 10px;
                  }
                }
              </style>
            </head>
            ${bodyTag(req)}
              <div class="container dashboard-container">
                ${dashboardHeader(user.role, user, user.role === 'admin' ? 'Admin Dashboard' : user.role === 'judge' ? 'Judge Dashboard' : user.role === 'registrar' ? 'Registrar' : 'Car Show Manager')}

                ${getNav(user.role, 'vote')}

                <div class="vote-header">
                  <h2>${vote.vote_name}</h2>
                  ${vote.description ? `<p>${vote.description}</p>` : ''}
                </div>

                <p style="color:#666;margin-bottom:15px;text-align:center;">Select the vehicle you want to vote for, then click Submit Vote.</p>

                <form action="/user/vote/${specialtyVoteId}/submit" method="POST">
                  ${vehicleCards}
                  ${cars.length > 0 ? '<button type="submit" class="submit-vote-btn">Submit Vote</button>' : ''}
                </form>

                <a href="/user/vote" class="back-link">Cancel and go back</a>
              </div>

              <!-- Fullscreen Image Modal -->
              <div class="image-modal" id="imageModal" onclick="closeImageModal()">
                <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
                <img id="modalImage" src="" alt="">
              </div>

              <script>
                function openImageModal(src, alt) {
                  const modal = document.getElementById('imageModal');
                  const img = document.getElementById('modalImage');
                  img.src = src;
                  img.alt = alt;
                  modal.classList.add('active');
                  document.body.style.overflow = 'hidden';
                }

                function closeImageModal() {
                  const modal = document.getElementById('imageModal');
                  modal.classList.remove('active');
                  document.body.style.overflow = '';
                }

                document.addEventListener('keydown', function(e) {
                  if (e.key === 'Escape') {
                    closeImageModal();
                  }
                });
              </script>
            </body>
            </html>
          `);
        });
      });
    });
  });

  // Handle vote submission
  router.post('/vote/:id/submit', requireAuth, (req, res) => {
    const user = req.session.user;
    const specialtyVoteId = req.params.id;
    const carId = req.body.car_id;

    // Check if voting is not open
    if (appConfig.specialtyVotingStatus !== 'Open') {
      res.redirect('/user/vote');
      return;
    }

    if (!carId) {
      res.redirect(`/user/vote/${specialtyVoteId}`);
      return;
    }

    // Verify user can vote in this specialty vote
    db.get(`
      SELECT sv.specialty_vote_id, sv.vote_name
      FROM specialty_votes sv
      LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id AND svv.user_id = ?
      WHERE sv.specialty_vote_id = ? AND sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id IS NOT NULL)
    `, [user.user_id, specialtyVoteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/user/vote');
        return;
      }

      // Check if user has already voted
      db.get('SELECT id FROM specialty_vote_results WHERE specialty_vote_id = ? AND user_id = ?',
        [specialtyVoteId, user.user_id], (err, existingVote) => {
        if (existingVote) {
          res.redirect('/user/vote');
          return;
        }

        // Insert the vote
        db.run('INSERT INTO specialty_vote_results (specialty_vote_id, user_id, car_id) VALUES (?, ?, ?)',
          [specialtyVoteId, user.user_id, carId], function(err) {
          if (err) {
            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Vote Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
              </head>
              ${bodyTag(req)}
                <div class="container">
                  <div class="logo">
                    <div class="logo-icon">🏎️</div>
                    <h1>Car Show Manager</h1>
                  </div>
                  <div class="error-message">Error submitting vote. You may have already voted in this category.</div>
                  <div class="links">
                    <a href="/user/vote">Back to Voting</a>
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
                <title>Vote Submitted!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
              </head>
              ${bodyTag(req)}
                <div class="container">
                  <div class="logo">
                    <div class="logo-icon">🎉</div>
                    <h1>Vote Submitted!</h1>
                  </div>
                  <div class="success-message">Thank you! Your vote for "${vote.vote_name}" has been recorded.</div>
                  <div class="links">
                    <a href="/user/vote">Vote in Another Category</a>
                    <a href="/user">Back to Dashboard</a>
                  </div>
                </div>
              </body>
              </html>
            `);
          }
        });
      });
    });
  });

  // ==========================================
  // USER VENDOR BROWSING ROUTES
  // ==========================================

  // Vendors list - all vendors with business info
  router.get('/vendors', requireAuth, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
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
          <a href="/user/vendors/${v.user_id}" class="vendor-browse-card">
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
          <title>Vendors - Car Show Manager</title>
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
            ${dashboardHeader('user', user, 'Car Show Manager')}

            ${getNav('user', 'vendors')}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}
          </div>
        </body>
        </html>
      `);
    });
  });

  // View vendor detail - products & services and booth info
  router.get('/vendors/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;
    const avatarContent = getAvatarContent(user);

    // Get vendor business info
    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/user/vendors');
        return;
      }

      // Get vendor products
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
          <a href="/user/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link">
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
            <title>${business.business_name || business.vendor_name} - Car Show Manager</title>
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
              ${dashboardHeader('user', user, 'Car Show Manager')}

              ${getNav('user', 'vendors')}

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
                <a href="/user/vendors">&larr; Back to Vendors</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireAuth, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/user/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/user/vendors/${vendorUserId}`);

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
              @media (min-width: 768px) {
                .product-detail-name { font-size: 26px; }
                .product-detail-price { font-size: 24px; }
              }
            </style>
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              ${dashboardHeader('user', user, 'Vendors')}
              ${getNav('user', 'vendors')}

              ${product.image_url ? `
              <div class="product-detail-image">
                <img src="${product.image_url}" alt="${product.product_name}">
              </div>
              ` : ''}

              <div class="product-detail-name${soldOut ? ' sold-out' : ''}">${product.product_name}${soldOut ? ' - SOLD OUT' : ''}</div>
              <div class="product-detail-vendor">by ${businessName}</div>

              <span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>

              ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
              ${product.price ? (product.discount_price
                ? `<div class="product-detail-price"><span style="text-decoration:line-through;color:#999;font-size:0.8em;">$${product.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${product.discount_price}</span></div>`
                : `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>`
              ) : ''}

              <div class="links" style="margin-top:20px;">
                <a href="/user/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
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
