// routes/vendor.js - Vendor dashboard, business info, products, and booth routes
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../middleware/auth');
  const { getAvatarContent, vendorNav } = require('../views/components');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { handleVendorImageUpload, deleteVendorImage } = require('../helpers/imageUpload');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);

  // Shared vendor page styles
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
      .vendor-image {
        width: 150px;
        height: 100px;
        object-fit: cover;
        border-radius: 8px;
        border: 2px solid #e1e1e1;
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
      .btn-add { background: #27ae60; color: white; padding: 6px 14px; font-size: 13px; border-radius: 6px; }
      .product-card.sold-out { opacity: 0.7; }
      .product-card.sold-out h5 { color: #e74c3c; }
      .price-sold-out { text-decoration: line-through; }
      .avail-toggle { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
      .avail-toggle span { font-size: 11px; font-weight: 600; color: #888; }
      .avail-toggle span.on { color: #27ae60; }
      .avail-toggle span.off { color: #e74c3c; }
      .toggle-switch { position: relative; width: 36px; height: 20px; cursor: pointer; }
      .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
      .toggle-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #e74c3c; border-radius: 20px; transition: background 0.2s; }
      .toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 2px; top: 2px; background: white; border-radius: 50%; transition: transform 0.2s; }
      .toggle-switch input:checked + .toggle-slider { background: #27ae60; }
      .toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }
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
    </style>
  `;

  // Helper: build the dashboard header
  function vendorHeader(user) {
    const avatarContent = getAvatarContent(user);
    return `
      <div class="dashboard-header">
        <h1>🏪 Vendor</h1>
        <div class="user-info">
          <div class="user-avatar">${avatarContent}</div>
          <a href="/vendor/profile" class="profile-btn">Profile</a>
          <a href="/logout" class="logout-btn">Sign Out</a>
        </div>
      </div>
    `;
  }

  // ── Vendor Dashboard ───────────────────────────────────────────────
  router.get('/', requireVendor, (req, res) => {
    const user = req.session.user;

    // Fetch business info
    db.get('SELECT * FROM vendor_business WHERE user_id = ?', [user.user_id], (err, business) => {
      // Fetch products
      db.all('SELECT * FROM vendor_products WHERE user_id = ? ORDER BY display_order, product_id', [user.user_id], (err2, products) => {
        if (!products) products = [];

        // Business Info section (card layout: image left, details right)
        const businessHtml = business ? `
          <div class="product-card">
            ${business.image_url ? `<img src="${business.image_url}" alt="${business.business_name || 'Business'}">` : ''}
            <div class="product-info">
              <h5>${business.business_name || '<em class="vendor-empty">Not set</em>'}</h5>
              ${business.business_email ? `<p>${business.business_email}</p>` : ''}
              ${business.business_phone ? `<p>${business.business_phone}</p>` : ''}
              ${(() => {
                const parts = [business.business_street, business.business_city, business.business_state].filter(Boolean);
                const line = parts.length > 0 ? (business.business_street ? business.business_street + (business.business_city || business.business_state ? ', ' : '') : '') + (business.business_city ? business.business_city + (business.business_state ? ', ' : '') : '') + (business.business_state || '') + (business.business_zip ? ' ' + business.business_zip : '') : '';
                return line ? `<p>${line}</p>` : '';
              })()}
              ${business.business_description ? `<p style="margin-top:4px;color:#555;font-style:italic;">${business.business_description}</p>` : ''}
            </div>
          </div>
        ` : `<p class="vendor-empty">No business information yet. Click "Edit" to add your business details.</p>`;

        // Products section
        const productsHtml = products.length > 0 ? products.map(p => {
          const soldOut = !p.available;
          return `
          <div class="product-card${soldOut ? ' sold-out' : ''}">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
            <div class="product-info">
              <h5>${p.product_name}${soldOut ? ' - SOLD OUT' : ''}</h5>
              ${p.description ? `<p>${p.description}</p>` : ''}
              ${p.price ? `<p class="product-price${soldOut ? ' price-sold-out' : ''}">$${p.price}</p>` : ''}
              <div class="product-actions">
                <a href="/vendor/edit-product/${p.product_id}" class="btn-sm btn-edit">Edit</a>
                <a href="#" onclick="if(confirm('Delete this product?'))document.getElementById('delProd${p.product_id}').submit();return false;" class="btn-sm btn-delete">Delete</a>
                <form id="delProd${p.product_id}" method="POST" action="/vendor/delete-product/${p.product_id}" style="display:none;"></form>
              </div>
              <div class="avail-toggle">
                <span class="${soldOut ? 'off' : ''}">Sold Out</span>
                <label class="toggle-switch">
                  <input type="checkbox" ${soldOut ? '' : 'checked'} onchange="document.getElementById('toggleAvail${p.product_id}').submit();">
                  <span class="toggle-slider"></span>
                </label>
                <span class="${soldOut ? '' : 'on'}">Available</span>
              </div>
              <form id="toggleAvail${p.product_id}" method="POST" action="/vendor/toggle-availability/${p.product_id}" style="display:none;"></form>
            </div>
          </div>`;
        }).join('') : `<p class="vendor-empty">No products or services added yet. Click "Add Product" to get started.</p>`;

        // Booth section
        const boothHtml = business && business.booth_location
          ? `<div class="vendor-detail">
               <span class="vendor-detail-label">Location</span>
               <span class="vendor-detail-value">${business.booth_location}</span>
             </div>`
          : `<p class="vendor-empty">No booth information set. Click "Edit" to add your booth location.</p>`;

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vendor Dashboard - ${appConfig.appTitle || 'Car Show Manager'}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${appBgStyles()}
            ${vendorStyles}
          </head>
          <body>
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('dashboard')}

              <div class="welcome-card">
                <h2>Welcome, ${user.name}!</h2>
                <p>Manage your vendor profile and business information.</p>
              </div>

              <div class="vendor-section">
                <h4>Business Information <a href="/vendor/edit-business" class="btn-sm btn-edit">Edit</a></h4>
                ${businessHtml}
              </div>

              <div class="vendor-section">
                <h4>Products &amp; Services <a href="/vendor/add-product" class="btn-sm btn-add">+ Add Product</a></h4>
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

              <div class="vendor-section">
                <h4>Booth Information <a href="/vendor/edit-booth" class="btn-sm btn-edit">Edit</a></h4>
                ${boothHtml}
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

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
          ${appBgStyles()}
          ${vendorStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard')}

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
          ${appBgStyles()}
          ${vendorStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard')}

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

  // ── Add Product ────────────────────────────────────────────────────
  router.get('/add-product', requireVendor, (req, res) => {
    const user = req.session.user;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add Product - ${appConfig.appTitle || 'Car Show Manager'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        ${appBgStyles()}
        ${vendorStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          ${vendorHeader(user)}
          ${vendorNav('dashboard')}

          <h3 class="section-title">Add Product / Service</h3>

          <form method="POST" action="/vendor/save-product" enctype="multipart/form-data" style="max-width:600px;">
            <div class="form-group">
              <label>Product / Service Name *</label>
              <input type="text" name="product_name" required placeholder="Enter product or service name">
            </div>
            <div class="form-group">
              <label>Description (Optional)</label>
              <input type="text" name="description" placeholder="Brief one-line description">
            </div>
            <div class="form-group">
              <label>Price (Optional)</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:600;">$</span>
                <input type="text" name="price" placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
              </div>
            </div>
            <div class="form-group">
              <label>Product Image (Optional)</label>
              <input type="file" name="productImage" accept="image/jpeg,image/png,image/gif,image/webp"
                style="padding:8px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;width:100%;">
            </div>
            <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Add Product</button>
          </form>

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
            } else if (el.value !== '') {
              el.value = '';
            }
          }
          </script>

          <div class="links" style="margin-top:20px;">
            <a href="/vendor">&larr; Back to Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Save new product
  router.post('/save-product', requireVendor, upload.single('productImage'), async (req, res) => {
    const user = req.session.user;
    const { product_name, description, price } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.send(errorPage('Product name is required.', '/vendor/add-product', 'Try Again'));
    }

    const formattedPrice = price ? parseFloat(price).toFixed(2) : null;

    let imageUrl = null;
    if (req.file) {
      try {
        const result = await handleVendorImageUpload(req.file);
        if (result.success) imageUrl = result.imageUrl;
      } catch (e) { /* skip image on error */ }
    }

    // Get next display_order
    db.get('SELECT MAX(display_order) as maxOrder FROM vendor_products WHERE user_id = ?', [user.user_id], (err, row) => {
      const nextOrder = (row && row.maxOrder !== null) ? row.maxOrder + 1 : 0;

      db.run('INSERT INTO vendor_products (user_id, product_name, description, price, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [user.user_id, product_name.trim(), description || null, formattedPrice, imageUrl, nextOrder],
        (err) => {
          if (err) return res.send(errorPage('Error adding product: ' + err.message, '/vendor/add-product', 'Try Again'));
          res.redirect('/vendor');
        });
    });
  });

  // ── Edit Product ───────────────────────────────────────────────────
  router.get('/edit-product/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;

    db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, user.user_id], (err, product) => {
      if (!product) return res.send(errorPage('Product not found.', '/vendor', 'Back to Dashboard'));

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Product - ${appConfig.appTitle || 'Car Show Manager'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          ${vendorStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard')}

            <h3 class="section-title">Edit Product / Service</h3>

            <form method="POST" action="/vendor/update-product/${product.product_id}" enctype="multipart/form-data" style="max-width:600px;">
              <div class="form-group">
                <label>Product / Service Name *</label>
                <input type="text" name="product_name" value="${product.product_name}" required placeholder="Enter product or service name">
              </div>
              <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" name="description" value="${product.description || ''}" placeholder="Brief one-line description">
              </div>
              <div class="form-group">
                <label>Price (Optional)</label>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-size:16px;font-weight:600;">$</span>
                  <input type="text" name="price" value="${product.price ? parseFloat(product.price).toFixed(2) : ''}" placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                </div>
              </div>

              ${product.image_url ? `
              <div class="form-group">
                <label>Current Image</label>
                <div style="margin-bottom:8px;"><img src="${product.image_url}" style="width:150px;height:100px;object-fit:cover;border-radius:8px;border:2px solid #e1e1e1;"></div>
              </div>
              ` : ''}

              <div class="form-group">
                <label>${product.image_url ? 'Replace' : 'Add'} Product Image (Optional)</label>
                <input type="file" name="productImage" accept="image/jpeg,image/png,image/gif,image/webp"
                  style="padding:8px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;width:100%;">
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save Changes</button>
                ${product.image_url ? `
                <button type="button" onclick="document.getElementById('removeImgForm').submit();"
                  style="background:#e74c3c;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:14px;">Remove Image</button>
                ` : ''}
              </div>
            </form>

            ${product.image_url ? `
            <form id="removeImgForm" method="POST" action="/vendor/remove-product-image/${product.product_id}" style="display:none;"></form>
            ` : ''}

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
              } else if (el.value !== '') {
                el.value = '';
              }
            }
            </script>

            <div class="links" style="margin-top:20px;">
              <a href="/vendor">&larr; Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // Update product
  router.post('/update-product/:id', requireVendor, upload.single('productImage'), async (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;
    const { product_name, description, price } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.send(errorPage('Product name is required.', `/vendor/edit-product/${productId}`, 'Try Again'));
    }

    const formattedPrice = price ? parseFloat(price).toFixed(2) : null;

    db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, user.user_id], async (err, product) => {
      if (!product) return res.send(errorPage('Product not found.', '/vendor', 'Back to Dashboard'));

      let imageUrl = product.image_url;
      if (req.file) {
        try {
          const result = await handleVendorImageUpload(req.file);
          if (result.success) {
            if (product.image_url) deleteVendorImage(product.image_url);
            imageUrl = result.imageUrl;
          }
        } catch (e) { /* keep old image on error */ }
      }

      db.run('UPDATE vendor_products SET product_name = ?, description = ?, price = ?, image_url = ? WHERE product_id = ? AND user_id = ?',
        [product_name.trim(), description || null, formattedPrice, imageUrl, productId, user.user_id],
        (err) => {
          if (err) return res.send(errorPage('Error updating product: ' + err.message, `/vendor/edit-product/${productId}`, 'Try Again'));
          res.redirect('/vendor');
        });
    });
  });

  // Remove product image
  router.post('/remove-product-image/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;

    db.get('SELECT image_url FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, user.user_id], (err, product) => {
      if (product && product.image_url) {
        deleteVendorImage(product.image_url);
        db.run('UPDATE vendor_products SET image_url = NULL WHERE product_id = ? AND user_id = ?',
          [productId, user.user_id], () => res.redirect(`/vendor/edit-product/${productId}`));
      } else {
        res.redirect(`/vendor/edit-product/${productId}`);
      }
    });
  });

  // Delete product
  router.post('/delete-product/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;

    db.get('SELECT image_url FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, user.user_id], (err, product) => {
      if (product && product.image_url) deleteVendorImage(product.image_url);
      db.run('DELETE FROM vendor_products WHERE product_id = ? AND user_id = ?',
        [productId, user.user_id], () => res.redirect('/vendor'));
    });
  });

  // Toggle product availability (sold out / available)
  router.post('/toggle-availability/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;

    db.run('UPDATE vendor_products SET available = CASE WHEN available = 1 THEN 0 ELSE 1 END WHERE product_id = ? AND user_id = ?',
      [productId, user.user_id], () => res.redirect('/vendor'));
  });


  // ==========================================
  // VENDOR BROWSING ROUTES (view other vendors)
  // ==========================================

  // Vendors list
  router.get('/vendors', requireVendor, (req, res) => {
    const user = req.session.user;

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1
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
          <a href="/vendor/vendors/${v.user_id}" class="vendor-browse-card">
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
          <title>Vendors - ${appConfig.appTitle || 'Car Show Manager'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBgStyles()}
          ${vendorStyles}
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
        <body>
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('vendors')}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}
          </div>
        </body>
        </html>
      `);
    });
  });

  // View vendor detail
  router.get('/vendors/:id', requireVendor, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/vendor/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
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
          <a href="/vendor/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link">
            <div class="product-card${soldOut ? ' sold-out' : ''}">
              ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
              <div class="product-info">
                <h5>${p.product_name}${soldOut ? ' - SOLD OUT' : ''}</h5>
                ${p.description ? `<p>${p.description}</p>` : ''}
                ${p.price ? `<p style="font-weight:600;color:#e94560;${soldOut ? 'text-decoration:line-through;' : ''}">$${p.price}</p>` : ''}
              </div>
            </div>
          </a>`;
        }).join('') : '<p style="color:#888;font-style:italic;">No products or services listed yet.</p>';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${business.business_name || business.vendor_name} - ${appConfig.appTitle || 'Car Show Manager'}</title>
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
              .product-card-link { text-decoration: none; color: inherit; display: block; }
              .product-card-link:active .product-card { background: #eef; }
              .product-card.sold-out { opacity: 0.7; }
              .product-card.sold-out h5 { color: #e74c3c; }
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
          <body>
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('vendors')}

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
                <a href="/vendor/vendors">&larr; Back to Vendors</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // View single product detail
  router.get('/vendors/:vendorId/product/:productId', requireVendor, (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    db.get(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/vendor/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId], (err2, product) => {
        if (err2 || !product) return res.redirect(`/vendor/vendors/${vendorUserId}`);

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
          <body>
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('vendors')}

              ${product.image_url ? `
              <div class="product-detail-image">
                <img src="${product.image_url}" alt="${product.product_name}">
              </div>
              ` : ''}

              <div class="product-detail-name${soldOut ? ' sold-out' : ''}">${product.product_name}${soldOut ? ' - SOLD OUT' : ''}</div>
              <div class="product-detail-vendor">by ${businessName}</div>

              <span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>

              ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
              ${product.price ? `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>` : ''}

              <div class="links" style="margin-top:20px;">
                <a href="/vendor/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
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
