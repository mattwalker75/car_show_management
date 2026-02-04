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

              ${business.image_url ? `
              <div class="form-group">
                <label>Current Image</label>
                <div style="margin-bottom:8px;"><img src="${business.image_url}" style="width:150px;height:100px;object-fit:cover;border-radius:8px;border:2px solid #e1e1e1;"></div>
              </div>
              ` : ''}

              <div class="form-group">
                <label>${business.image_url ? 'Replace' : 'Add'} Business Image (Optional)</label>
                <input type="file" name="businessImage" accept="image/jpeg,image/png,image/gif,image/webp"
                  style="padding:8px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;width:100%;">
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save Business Info</button>
                ${business.image_url ? `
                <button type="button" onclick="document.getElementById('removeBizImgForm').submit();"
                  style="background:#e74c3c;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:14px;">Remove Image</button>
                ` : ''}
              </div>
            </form>

            ${business.image_url ? `
            <form id="removeBizImgForm" method="POST" action="/vendor/remove-business-image" style="display:none;"></form>
            ` : ''}

            <div class="links" style="margin-top:20px;">
              <a href="/vendor">&larr; Back to Dashboard</a>
            </div>
          </div>
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
