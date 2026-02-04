// routes/vendor/products.js - Product CRUD operations
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const { handleVendorImageUpload, deleteVendorImage } = require('../../helpers/imageUpload');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles, vendorNav,
    vendorStyles, vendorHeader, priceScript, isChatEnabled
  } = require('./shared');

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
        ${getAppBgStyles(appConfig)}
        ${vendorStyles}
      </head>
      ${getBodyTag(req)}
        <div class="container dashboard-container">
          ${vendorHeader(user)}
          ${vendorNav('dashboard', isChatEnabled(appConfig, user))}

          <h3 class="section-title">Add Product / Service</h3>

          <form method="POST" action="/vendor/save-product" enctype="multipart/form-data" style="max-width:600px;">
            <div class="form-group" style="text-align:center;">
              <label>Product Image (Optional)</label>
              <div id="prodImageDisplay" style="margin:10px auto;">
                <div class="current-image-placeholder" style="width:120px;height:80px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:36px;">🛍️</div>
              </div>
              <button type="button" id="prodImageBtn" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Update Image</button>
              <div style="margin-top:6px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
              <input type="file" name="productImage" id="prodImageInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
            </div>

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
            <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Add Product</button>
          </form>

          <!-- Product image preview modal (outside form) -->
          <div id="prodImageModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
            <div style="background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
              <h4 style="margin:0 0 16px;color:#2c3e50;">Preview Product Image</h4>
              <img id="prodImagePreview" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid #e1e1e1;">
              <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                <button type="button" id="prodImageSave" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                <button type="button" id="prodImageCancel" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
              </div>
            </div>
          </div>

          ${priceScript}

          <div class="links" style="margin-top:20px;">
            <a href="/vendor">&larr; Back to Dashboard</a>
          </div>
        </div>
        <script>
          (function() {
            var btn = document.getElementById('prodImageBtn');
            var input = document.getElementById('prodImageInput');
            var modal = document.getElementById('prodImageModal');
            var preview = document.getElementById('prodImagePreview');
            var saveBtn = document.getElementById('prodImageSave');
            var cancelBtn = document.getElementById('prodImageCancel');
            var display = document.getElementById('prodImageDisplay');
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
          ${getAppBgStyles(appConfig)}
          ${vendorStyles}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('dashboard', isChatEnabled(appConfig, user))}

            <h3 class="section-title">Edit Product / Service</h3>

            ${product.admin_deactivated ? `
            <div style="background:#fde8e8;border:2px solid #e74c3c;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
              <div style="font-weight:700;color:#e74c3c;">Product deactivated by Admin</div>
              <div style="font-size:13px;color:#c0392b;">This product has been deactivated by an administrator and is hidden from other users.</div>
            </div>
            ` : ''}

            <form method="POST" action="/vendor/update-product/${product.product_id}" enctype="multipart/form-data" style="max-width:600px;">
              <div class="form-group" style="text-align:center;">
                <label>Product Image (Optional)</label>
                <div id="editProdImageDisplay" style="margin:10px auto;">
                  ${product.image_url
                    ? `<img src="${product.image_url}" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid #e1e1e1;object-fit:cover;">`
                    : `<div class="current-image-placeholder" style="width:120px;height:80px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:36px;">🛍️</div>`
                  }
                </div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                  <button type="button" id="editProdImageBtn" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">Update Image</button>
                  ${product.image_url ? `
                  <button type="button" onclick="document.getElementById('removeImgForm').submit();"
                    style="background:#e74c3c;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;text-transform:none;letter-spacing:normal;min-height:auto;">Remove Image</button>
                  ` : ''}
                </div>
                <div style="margin-top:6px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
                <input type="file" name="productImage" id="editProdImageInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
              </div>

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
              <div class="form-group">
                <label>Discount Price (Optional)</label>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-size:16px;font-weight:600;">$</span>
                  <input type="text" name="discount_price" value="${product.discount_price ? parseFloat(product.discount_price).toFixed(2) : ''}" placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                </div>
                <small style="color:#888;display:block;margin-top:4px;">If set, the original price will be shown with a line through it and this discount price will appear next to it.</small>
              </div>

              <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save Changes</button>
            </form>

            ${product.image_url ? `
            <form id="removeImgForm" method="POST" action="/vendor/remove-product-image/${product.product_id}" style="display:none;"></form>
            ` : ''}

            <!-- Edit product image preview modal (outside form) -->
            <div id="editProdImageModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
              <div style="background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                <h4 style="margin:0 0 16px;color:#2c3e50;">Preview Product Image</h4>
                <img id="editProdImagePreview" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid #e1e1e1;">
                <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                  <button type="button" id="editProdImageSave" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                  <button type="button" id="editProdImageCancel" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
              </div>
            </div>

            ${priceScript}

            <div class="links" style="margin-top:20px;">
              <a href="/vendor">&larr; Back to Dashboard</a>
            </div>
          </div>
          <script>
            (function() {
              var btn = document.getElementById('editProdImageBtn');
              var input = document.getElementById('editProdImageInput');
              var modal = document.getElementById('editProdImageModal');
              var preview = document.getElementById('editProdImagePreview');
              var saveBtn = document.getElementById('editProdImageSave');
              var cancelBtn = document.getElementById('editProdImageCancel');
              var display = document.getElementById('editProdImageDisplay');
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

  // Update product
  router.post('/update-product/:id', requireVendor, upload.single('productImage'), async (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;
    const { product_name, description, price, discount_price } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.send(errorPage('Product name is required.', `/vendor/edit-product/${productId}`, 'Try Again'));
    }

    const formattedPrice = price ? parseFloat(price).toFixed(2) : null;
    const formattedDiscount = discount_price ? parseFloat(discount_price).toFixed(2) : null;

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

      db.run('UPDATE vendor_products SET product_name = ?, description = ?, price = ?, discount_price = ?, image_url = ? WHERE product_id = ? AND user_id = ?',
        [product_name.trim(), description || null, formattedPrice, formattedDiscount, imageUrl, productId, user.user_id],
        (err) => {
          if (err) return res.send(errorPage('Error updating product: ' + err.message, `/vendor/edit-product/${productId}`, 'Try Again'));

          // Notify all users if a discount price was added or changed
          if (formattedDiscount && formattedDiscount !== product.discount_price) {
            const displayPrice = formattedPrice || product.price || '0.00';
            db.get('SELECT business_name FROM vendor_business WHERE user_id = ?', [user.user_id], (err2, biz) => {
              if (!err2) {
                const vendorName = (biz && biz.business_name) || user.name;
                const io = req.app.get('io');
                io.to('role:all').emit('notification', {
                  message: vendorName + ' reduced the price for ' + product_name.trim() + ' from $' + displayPrice + ' to $' + formattedDiscount,
                  icon: '\uD83D\uDCB0'
                });
              }
            });
          }

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

  return router;
};
