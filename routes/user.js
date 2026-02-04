// routes/user.js - User dashboard, vehicle registration/edit/delete, and voting routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth } = require('../middleware/auth');
  const { errorPage, getAppBackgroundStyles } = require('../views/layout');
  const { getInitials, getAvatarContent, getNav, dashboardHeader } = require('../views/components');
  const { handleVehiclePhotoUpload, deleteVehicleImage } = require('../helpers/imageUpload');
  const { renderVendorListPage, renderVendorDetailPage, renderProductDetailPage } = require('../helpers/vendorViews');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => { const u = req.session && req.session.user; const theme = appConfig.theme || 'light'; return `<body data-theme="${theme}" data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`; };

  router.get('/', requireAuth, (req, res) => {
    const user = req.session.user;
    const initials = getInitials(user.name);
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
      `).join('') : '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">You haven\'t registered any vehicles yet.</p>';

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
              background: var(--card-bg);
              border-radius: 12px;
              padding: 12px;
              margin-bottom: 12px;
              border: 1px solid var(--card-border);
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
              background: var(--card-border);
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
              color: var(--text-primary);
              margin-bottom: 6px;
            }
            .vehicle-class {
              margin-bottom: 6px;
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }
            .type-badge {
              background: var(--btn-edit-bg);
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
              color: var(--text-secondary);
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
              ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
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
    const initials = getInitials(user.name);
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
                background: var(--card-bg);
                border: 2px dashed var(--card-border);
                border-radius: 12px;
                text-align: center;
                color: var(--text-secondary);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .file-input-wrapper:hover .file-input-label {
                border-color: var(--accent-primary);
                background: var(--error-bg);
              }
              .file-input-wrapper.has-file .file-input-label {
                border-color: var(--success-color);
                background: rgba(39, 174, 96, 0.1);
                color: var(--success-color);
              }
              .file-name {
                margin-top: 8px;
                font-size: 13px;
                color: var(--success-color);
                text-align: center;
                font-weight: 600;
              }
              textarea {
                width: 100%;
                padding: 16px;
                border: 2px solid var(--card-border);
                border-radius: 12px;
                font-size: 16px;
                font-family: inherit;
                resize: vertical;
                min-height: 100px;
                background: var(--card-bg);
              }
              textarea:focus {
                border-color: var(--accent-primary);
                outline: none;
                background: var(--modal-content-bg);
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
                ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                <a href="/user/vote">Vote Here!</a>
                <a href="/user/profile">My Profile</a>
              </div>

              <h3 class="section-title">Register New Vehicle</h3>

              ${vehicleTypes.length === 0 ? '<div class="error-message">No vehicle types are available. Please contact the administrator.</div>' : ''}

              <form method="POST" action="/user/register-vehicle" enctype="multipart/form-data">
                <div class="profile-card">
                  <div class="form-group" style="text-align:center;">
                    <label>Vehicle Photo (Optional)</label>
                    <div class="current-image-placeholder" id="vehiclePhotoDisplay" style="margin:10px auto;">🚗</div>
                    <button type="button" id="vehiclePhotoBtn" style="background:var(--btn-edit-bg);color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Update Photo</button>
                    <div style="margin-top:6px;color:var(--text-muted);font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
                    <input type="file" name="vehicle_photo" id="vehiclePhotoInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
                  </div>
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
                  <button type="submit">Register Vehicle</button>
                </div>
              </form>
              <div id="vehiclePhotoModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
                <div style="background:var(--modal-content-bg);border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                  <h4 style="margin:0 0 16px;color:var(--heading-alt);">Preview Vehicle Photo</h4>
                  <img id="vehiclePhotoPreview" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid var(--card-border);">
                  <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                    <button type="button" id="vehiclePhotoSave" style="padding:10px 28px;background:var(--success-color);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                    <button type="button" id="vehiclePhotoCancel" style="padding:10px 28px;background:var(--btn-cancel-bg);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                  </div>
                </div>
              </div>

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

                (function() {
                  var btn = document.getElementById('vehiclePhotoBtn');
                  var input = document.getElementById('vehiclePhotoInput');
                  var modal = document.getElementById('vehiclePhotoModal');
                  var preview = document.getElementById('vehiclePhotoPreview');
                  var saveBtn = document.getElementById('vehiclePhotoSave');
                  var cancelBtn = document.getElementById('vehiclePhotoCancel');
                  var display = document.getElementById('vehiclePhotoDisplay');
                  if (!btn || !input) return;
                  btn.addEventListener('click', function() { input.click(); });
                  input.addEventListener('change', function() {
                    if (!input.files || !input.files[0]) return;
                    var file = input.files[0];
                    var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    if (allowedTypes.indexOf(file.type) === -1) {
                      alert('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
                      input.value = '';
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      alert('File is too large. Maximum size is 5MB.');
                      input.value = '';
                      return;
                    }
                    var reader = new FileReader();
                    reader.onload = function(e) {
                      preview.src = e.target.result;
                      modal.style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                  });
                  cancelBtn.addEventListener('click', function() {
                    modal.style.display = 'none';
                    input.value = '';
                  });
                  modal.addEventListener('click', function(e) {
                    if (e.target === modal) { modal.style.display = 'none'; input.value = ''; }
                  });
                  saveBtn.addEventListener('click', function() {
                    if (!input.files || !input.files[0]) return;
                    display.innerHTML = '<img src="' + preview.src + '" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid var(--card-border);">';
                    modal.style.display = 'none';
                  });
                })();
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
    try {
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
            res.redirect('/user');
          }
        });
    } catch (err) {
      console.error('Error registering vehicle:', err.message);
      res.send(errorPage('An unexpected error occurred. Please try again.', '/user/register-vehicle', 'Try Again'));
    }
  });

  // Edit vehicle page
  router.get('/edit-vehicle/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const carId = req.params.id;
    const initials = getInitials(user.name);
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
                  background: var(--card-bg);
                  border: 2px dashed var(--card-border);
                  border-radius: 12px;
                  text-align: center;
                  color: var(--text-secondary);
                  font-size: 14px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                }
                .file-input-wrapper:hover .file-input-label {
                  border-color: var(--accent-primary);
                  background: var(--error-bg);
                }
                .file-input-wrapper.has-file .file-input-label {
                  border-color: var(--success-color);
                  background: rgba(39, 174, 96, 0.1);
                  color: var(--success-color);
                }
                .file-name {
                  margin-top: 8px;
                  font-size: 13px;
                  color: var(--success-color);
                  text-align: center;
                  font-weight: 600;
                }
                textarea {
                  width: 100%;
                  padding: 16px;
                  border: 2px solid var(--card-border);
                  border-radius: 12px;
                  font-size: 16px;
                  font-family: inherit;
                  resize: vertical;
                  min-height: 100px;
                  background: var(--card-bg);
                }
                textarea:focus {
                  border-color: var(--accent-primary);
                  outline: none;
                  background: var(--modal-content-bg);
                  box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
                }
                .delete-btn {
                  display: block;
                  width: 100%;
                  padding: 16px;
                  background: var(--btn-delete-bg);
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
                  ${(appConfig.chatEnabled !== false && req.session.user.chat_enabled) ? '<a href="/chat">Chat</a>' : ''}
                  <a href="/user/vote">Vote Here!</a>
                  <a href="/user/profile">My Profile</a>
                </div>

                <h3 class="section-title">Edit Vehicle: ${car.year ? car.year + ' ' : ''}${car.make} ${car.model}</h3>

                <form method="POST" action="/user/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
                  <div class="profile-card">
                    <div class="form-group" style="text-align:center;">
                      <label>Vehicle Photo</label>
                      <div id="vehiclePhotoDisplay" style="margin:10px auto;">
                        ${car.image_url
                          ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid var(--card-border);">`
                          : `<div class="current-image-placeholder">🚗</div>`
                        }
                      </div>
                      <button type="button" id="vehiclePhotoBtn" style="background:var(--btn-edit-bg);color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Update Photo</button>
                      <div style="margin-top:6px;color:var(--text-muted);font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
                      <input type="file" name="vehicle_photo" id="vehiclePhotoInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
                    </div>
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
                    <button type="submit">Update Vehicle</button>
                  </div>
                </form>
                <div id="vehiclePhotoModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
                  <div style="background:var(--modal-content-bg);border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                    <h4 style="margin:0 0 16px;color:var(--heading-alt);">Preview Vehicle Photo</h4>
                    <img id="vehiclePhotoPreview" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid var(--card-border);">
                    <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                      <button type="button" id="vehiclePhotoSave" style="padding:10px 28px;background:var(--success-color);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                      <button type="button" id="vehiclePhotoCancel" style="padding:10px 28px;background:var(--btn-cancel-bg);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                    </div>
                  </div>
                </div>

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

                  (function() {
                    var btn = document.getElementById('vehiclePhotoBtn');
                    var input = document.getElementById('vehiclePhotoInput');
                    var modal = document.getElementById('vehiclePhotoModal');
                    var preview = document.getElementById('vehiclePhotoPreview');
                    var saveBtn = document.getElementById('vehiclePhotoSave');
                    var cancelBtn = document.getElementById('vehiclePhotoCancel');
                    var display = document.getElementById('vehiclePhotoDisplay');
                    if (!btn || !input) return;
                    btn.addEventListener('click', function() { input.click(); });
                    input.addEventListener('change', function() {
                      if (!input.files || !input.files[0]) return;
                      var file = input.files[0];
                      var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                      if (allowedTypes.indexOf(file.type) === -1) {
                        alert('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
                        input.value = '';
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File is too large. Maximum size is 5MB.');
                        input.value = '';
                        return;
                      }
                      var reader = new FileReader();
                      reader.onload = function(e) {
                        preview.src = e.target.result;
                        modal.style.display = 'flex';
                      };
                      reader.readAsDataURL(file);
                    });
                    cancelBtn.addEventListener('click', function() {
                      modal.style.display = 'none';
                      input.value = '';
                    });
                    modal.addEventListener('click', function(e) {
                      if (e.target === modal) { modal.style.display = 'none'; input.value = ''; }
                    });
                    saveBtn.addEventListener('click', function() {
                      if (!input.files || !input.files[0]) return;
                      display.innerHTML = '<img src="' + preview.src + '" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid var(--card-border);">';
                      modal.style.display = 'none';
                    });
                  })();
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

      try {
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
              res.redirect('/user');
            }
          });
      } catch (err) {
        console.error('Error updating vehicle:', err.message);
        res.send(errorPage('An unexpected error occurred. Please try again.', `/user/edit-vehicle/${carId}`, 'Try Again'));
      }
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
          res.redirect('/user');
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
      `).join('') : '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No registered vehicles yet.</p>';

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
              background: var(--card-bg);
              border-radius: 12px;
              padding: 12px;
              margin-bottom: 12px;
              border: 1px solid var(--card-border);
              display: flex;
              flex-direction: row;
              gap: 12px;
              align-items: center;
              text-decoration: none;
              color: inherit;
              transition: all 0.2s ease;
            }
            .vehicle-browse-card:active {
              background: var(--card-bg);
            }
            .vehicle-browse-image {
              width: 100px;
              height: 75px;
              border-radius: 8px;
              overflow: hidden;
              background: var(--card-border);
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
              color: var(--text-primary);
            }
            .vehicle-browse-owner {
              font-size: 13px;
              color: var(--text-muted);
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
                border-color: var(--accent-primary);
                box-shadow: 0 2px 10px var(--container-shadow);
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

            ${getNav('user', 'vehicles', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

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
              background: var(--card-border);
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
            .description-section {
              background: var(--card-bg);
              padding: 16px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .description-section h4 {
              color: var(--text-primary);
              margin-bottom: 8px;
            }
            .description-section p {
              color: var(--text-secondary);
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

            ${getNav('user', 'vehicles', (appConfig.chatEnabled !== false && req.session.user.chat_enabled))}

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
    const initials = getInitials(user.name);
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
          <div style="background:var(--status-active-bg);color:var(--success-dark-text);padding:10px;border-radius:8px;margin-bottom:8px;">
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
                background: var(--card-bg);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid var(--card-border);
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
                background: var(--card-border);
                cursor: not-allowed;
              }
              .no-votes-message {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-secondary);
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

              ${getNav(user.role, 'vote', (appConfig.chatEnabled !== false && user.chat_enabled))}

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
    const initials = getInitials(user.name);
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
          `).join('') : '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No vehicles are currently registered.</p>';

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
                  background: var(--card-bg);
                  border-radius: 12px;
                  margin-bottom: 12px;
                  border: 2px solid var(--card-border);
                  cursor: pointer;
                  transition: all 0.2s ease;
                }
                .vehicle-vote-card:hover {
                  border-color: var(--accent-primary);
                }
                .vehicle-vote-card input[type="radio"] {
                  display: none;
                }
                .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content {
                  border-color: var(--accent-primary);
                  background: var(--error-bg);
                }
                .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content .checkmark {
                  background: #e94560;
                  border-color: var(--accent-primary);
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
                  background: var(--card-border);
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
                  color: var(--text-primary);
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
                  color: var(--text-secondary);
                  display: -webkit-box;
                  -webkit-line-clamp: 1;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                .vehicle-vote-owner {
                  font-size: 11px;
                  color: var(--text-muted);
                  margin-top: 2px;
                }
                .vehicle-vote-check {
                  flex-shrink: 0;
                }
                .checkmark {
                  display: block;
                  width: 24px;
                  height: 24px;
                  border: 2px solid var(--card-border);
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
                  background: var(--btn-dark-bg);
                  color: white;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 600;
                  margin-right: 6px;
                }
                .type-badge {
                  background: var(--btn-edit-bg);
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
                  color: var(--text-secondary);
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

                ${getNav(user.role, 'vote', (appConfig.chatEnabled !== false && user.chat_enabled))}

                <div class="vote-header">
                  <h2>${vote.vote_name}</h2>
                  ${vote.description ? `<p>${vote.description}</p>` : ''}
                </div>

                <p style="color:var(--text-secondary);margin-bottom:15px;text-align:center;">Select the vehicle you want to vote for, then click Submit Vote.</p>

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
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];
      const nav = getNav('user', 'vendors', chatEnabled);
      const header = dashboardHeader('user', user, 'Car Show Manager');
      res.send(renderVendorListPage({ vendors, user, role: 'user', appConfig, nav, header, isAdmin: false }));
    });
  });

  // View vendor detail - products & services and booth info
  router.get('/vendors/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/user/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL) ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
        if (!products) products = [];
        const nav = getNav('user', 'vendors', chatEnabled);
        const header = dashboardHeader('user', user, 'Car Show Manager');
        res.send(renderVendorDetailPage({ business, products, user, role: 'user', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireAuth, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;
    const chatEnabled = appConfig.chatEnabled !== false && user.chat_enabled;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1
            AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/user/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/user/vendors/${vendorUserId}`);
        const nav = getNav('user', 'vendors', chatEnabled);
        const header = dashboardHeader('user', user, 'Car Show Manager');
        res.send(renderProductDetailPage({ product, business, user, role: 'user', appConfig, nav, header, isAdmin: false }));
      });
    });
  });

  return router;
};
