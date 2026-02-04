// routes/vendor/business.js - Business and booth information management
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const { handleVendorImageUpload, deleteVendorImage } = require('../../helpers/imageUpload');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles, vendorNav,
    vendorStyles, vendorHeader, isChatEnabled
  } = require('./shared');

  // ── Edit Business Information ────────────────────────────────────────
  router.get('/edit-business', requireVendor, (req, res) => {
    const user = req.session.user;

    db.get('SELECT * FROM vendor_business WHERE user_id = ?', [user.user_id], (err, business) => {
      if (!business) business = {};

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Business - ${appConfig.appTitle || 'Car Show Manager'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
          ${vendorStyles}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard', isChatEnabled(appConfig, user))}

            <h3 class="section-title">Edit Business Information</h3>

            <form method="POST" action="/vendor/save-business" enctype="multipart/form-data" style="max-width:600px;">
              <div class="form-group" style="text-align:center;">
                <label>Business Image (Optional)</label>
                <div id="bizImageDisplay" style="margin:10px auto;">
                  ${business.image_url
                    ? `<img src="${business.image_url}" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid #e1e1e1;object-fit:cover;">`
                    : `<div class="current-image-placeholder" style="width:120px;height:80px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:36px;">🏪</div>`
                  }
                </div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                  <button type="button" id="bizImageBtn" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Update Image</button>
                  ${business.image_url ? `
                  <button type="button" onclick="document.getElementById('removeBizImgForm').submit();"
                    style="background:#e74c3c;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;text-transform:none;letter-spacing:normal;min-height:auto;">Remove Image</button>
                  ` : ''}
                </div>
                <div style="margin-top:6px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
                <input type="file" name="businessImage" id="bizImageInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
              </div>

              <div class="form-group">
                <label>Business Name</label>
                <input type="text" name="business_name" value="${business.business_name || ''}" placeholder="Enter business name">
              </div>
              <div class="form-group">
                <label>Business Email (Optional)</label>
                <input type="email" name="business_email" value="${business.business_email || ''}" placeholder="Enter business email">
              </div>
              <div class="form-group">
                <label>Business Phone (Optional)</label>
                <input type="text" name="business_phone" value="${business.business_phone || ''}" placeholder="Enter business phone">
              </div>
              <div class="form-group">
                <label>Street (Optional)</label>
                <input type="text" name="business_street" value="${business.business_street || ''}" placeholder="Enter street address">
              </div>
              <div class="form-group">
                <label>City (Optional)</label>
                <input type="text" name="business_city" value="${business.business_city || ''}" placeholder="Enter city">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="form-group" style="flex:1;">
                  <label>State (Optional)</label>
                  <input type="text" name="business_state" value="${business.business_state || ''}" placeholder="e.g. TX" maxlength="2" style="text-transform:uppercase;">
                </div>
                <div class="form-group" style="flex:1;">
                  <label>Zip (Optional)</label>
                  <input type="text" name="business_zip" value="${business.business_zip || ''}" placeholder="e.g. 75001" maxlength="10">
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea name="business_description" rows="3" maxlength="200" placeholder="Brief description of your business (1-2 sentences)" style="resize:vertical;min-height:70px;width:100%;box-sizing:border-box;">${business.business_description || ''}</textarea>
                <small style="color:#888;display:block;margin-top:4px;">${(business.business_description || '').length}/200 characters</small>
              </div>

              <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save Business Info</button>
            </form>

            ${business.image_url ? `
            <form id="removeBizImgForm" method="POST" action="/vendor/remove-business-image" style="display:none;"></form>
            ` : ''}

            <!-- Business image preview modal (outside form to avoid nesting) -->
            <div id="bizImageModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
              <div style="background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                <h4 style="margin:0 0 16px;color:#2c3e50;">Preview Business Image</h4>
                <img id="bizImagePreview" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid #e1e1e1;">
                <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                  <button type="button" id="bizImageSave" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                  <button type="button" id="bizImageCancel" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
              </div>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/vendor">&larr; Back to Dashboard</a>
            </div>
          </div>
          <script>
            (function() {
              var btn = document.getElementById('bizImageBtn');
              var input = document.getElementById('bizImageInput');
              var modal = document.getElementById('bizImageModal');
              var preview = document.getElementById('bizImagePreview');
              var saveBtn = document.getElementById('bizImageSave');
              var cancelBtn = document.getElementById('bizImageCancel');
              var display = document.getElementById('bizImageDisplay');
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
                display.innerHTML = '<img src="' + preview.src + '" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid #e1e1e1;object-fit:cover;">';
                modal.style.display = 'none';
              });
            })();
          </script>
        </body>
        </html>
      `);
    });
  });

  // Save business info (with optional image upload)
  router.post('/save-business', requireVendor, upload.single('businessImage'), async (req, res) => {
    const user = req.session.user;
    const { business_name, business_email, business_phone, business_street, business_city, business_state, business_zip, business_description } = req.body;

    // Process optional image upload
    let newImageUrl = null;
    if (req.file) {
      try {
        const result = await handleVendorImageUpload(req.file);
        if (result.success) newImageUrl = result.imageUrl;
      } catch (e) { /* skip image on error */ }
    }

    db.get('SELECT * FROM vendor_business WHERE user_id = ?', [user.user_id], (err, existing) => {
      if (existing) {
        // Delete old image if a new one was uploaded
        if (newImageUrl && existing.image_url) deleteVendorImage(existing.image_url);
        const imageUrl = newImageUrl || existing.image_url;

        db.run(`UPDATE vendor_business SET business_name = ?, business_email = ?, business_phone = ?,
                business_street = ?, business_city = ?, business_state = ?, business_zip = ?,
                business_description = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [business_name || null, business_email || null, business_phone || null,
           business_street || null, business_city || null, business_state || null, business_zip || null,
           business_description || null, imageUrl, user.user_id],
          (err) => {
            if (err) return res.send(errorPage('Error saving business info: ' + err.message, '/vendor/edit-business', 'Try Again'));
            res.redirect('/vendor');
          });
      } else {
        db.run(`INSERT INTO vendor_business (user_id, business_name, business_email, business_phone, business_street, business_city, business_state, business_zip, business_description, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.user_id, business_name || null, business_email || null, business_phone || null,
           business_street || null, business_city || null, business_state || null, business_zip || null,
           business_description || null, newImageUrl],
          (err) => {
            if (err) return res.send(errorPage('Error saving business info: ' + err.message, '/vendor/edit-business', 'Try Again'));
            res.redirect('/vendor');
          });
      }
    });
  });

  // Remove business image
  router.post('/remove-business-image', requireVendor, (req, res) => {
    const user = req.session.user;
    db.get('SELECT image_url FROM vendor_business WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        deleteVendorImage(row.image_url);
        db.run('UPDATE vendor_business SET image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [user.user_id], () => res.redirect('/vendor/edit-business'));
      } else {
        res.redirect('/vendor/edit-business');
      }
    });
  });

  // ── Edit Booth Information ──────────────────────────────────────────
  router.get('/edit-booth', requireVendor, (req, res) => {
    const user = req.session.user;

    db.get('SELECT * FROM vendor_business WHERE user_id = ?', [user.user_id], (err, business) => {
      if (!business) business = {};

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Booth - ${appConfig.appTitle || 'Car Show Manager'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
          ${vendorStyles}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard', isChatEnabled(appConfig, user))}

            <h3 class="section-title">Edit Booth Information</h3>

            <form method="POST" action="/vendor/save-booth" style="max-width:600px;">
              <div class="form-group">
                <label>Booth Location</label>
                <input type="text" name="booth_location" value="${business.booth_location || ''}" placeholder="e.g. Table 5, Row B, Section C">
                <small style="color:#666;display:block;margin-top:5px;">Enter your booth table number, area, or location description</small>
              </div>
              <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save Booth Info</button>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/vendor">&larr; Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // Save booth info
  router.post('/save-booth', requireVendor, (req, res) => {
    const user = req.session.user;
    const { booth_location } = req.body;

    db.get('SELECT * FROM vendor_business WHERE user_id = ?', [user.user_id], (err, existing) => {
      if (existing) {
        db.run('UPDATE vendor_business SET booth_location = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [booth_location || null, user.user_id], (err) => {
            if (err) return res.send(errorPage('Error saving booth info: ' + err.message, '/vendor/edit-booth', 'Try Again'));
            res.redirect('/vendor');
          });
      } else {
        db.run('INSERT INTO vendor_business (user_id, booth_location) VALUES (?, ?)',
          [user.user_id, booth_location || null], (err) => {
            if (err) return res.send(errorPage('Error saving booth info: ' + err.message, '/vendor/edit-booth', 'Try Again'));
            res.redirect('/vendor');
          });
      }
    });
  });

  return router;
};
