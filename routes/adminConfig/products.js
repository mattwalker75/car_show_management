// routes/adminConfig/products.js - Event products configuration routes
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Price validation script (reused from vendor products)
  const priceScript = `
    <script>
      function validatePriceInput(el) {
        var v = el.value.replace(/[^0-9.]/g, '');
        var parts = v.split('.');
        if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
        if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
        el.value = v;
      }
      function formatPriceBlur(el) {
        if (el.value) {
          var n = parseFloat(el.value);
          if (!isNaN(n)) el.value = n.toFixed(2);
        }
      }
    </script>`;

  // ── Products List Page ──────────────────────────────────────────────────
  router.get('/products', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.all('SELECT * FROM products ORDER BY display_order, product_name', (err, products) => {
      if (err) products = [];

      const productRows = products.map(p => {
        const priceDisplay = p.discount_price
          ? `<span style="text-decoration:line-through;color:var(--text-muted);">$${p.price || '0.00'}</span> <span style="color:var(--success-color);font-weight:600;">$${p.discount_price}</span>`
          : (p.price ? `$${p.price}` : 'N/A');

        return `
          <tr>
            <td>${p.product_name}</td>
            <td>${p.description || '<span style="color:var(--text-muted);">-</span>'}</td>
            <td>${priceDisplay}</td>
            <td><span class="status-badge ${p.available && !p.admin_deactivated ? 'active' : 'inactive'}">${p.admin_deactivated ? 'Deactivated' : (p.available ? 'Available' : 'Sold Out')}</span></td>
            <td>
              <a href="/admin/edit-product/${p.product_id}" class="action-btn edit">Edit</a>
              <a href="#" onclick="confirmDeleteProduct(${p.product_id}, '${p.product_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:var(--btn-delete-bg);">Delete</a>
            </td>
          </tr>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Products Config - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

            <h3 class="section-title">Event Products</h3>
            <p style="color:var(--text-secondary);margin-bottom:15px;">Manage products like raffle tickets, shirts, merchandise, etc. that can be sold during registration.</p>

            <div style="margin-bottom:20px;">
              <a href="/admin/add-product" class="action-btn" style="background:var(--success-color);padding:12px 24px;font-size:15px;">+ New Product</a>
            </div>

            <div class="table-wrapper config-table">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No products defined yet. Click "New Product" to add one.</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
            </div>
          </div>

          <script>
            function confirmDeleteProduct(id, name) {
              if (confirm('Are you sure you want to delete "' + name + '"? This cannot be undone.')) {
                var form = document.createElement('form');
                form.method = 'POST';
                form.action = '/admin/delete-product/' + id;
                document.body.appendChild(form);
                form.submit();
              }
            }
          </script>
        </body>
        </html>
      `);
    });
  });

  // ── Add Product Page ────────────────────────────────────────────────────
  router.get('/add-product', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add Product - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        ${getAppBgStyles(appConfig)}
      </head>
      ${getBodyTag(req)}
        <div class="container dashboard-container">
          ${adminHeader(user)}
          ${getAdminNav('config', chatEnabled)}

          <h3 class="section-title">Add Product</h3>

          <form method="POST" action="/admin/save-product" style="max-width:600px;">
            <div class="form-group">
              <label>Product Name *</label>
              <input type="text" name="product_name" required placeholder="Enter product name">
            </div>
            <div class="form-group">
              <label>Description (Optional)</label>
              <input type="text" name="description" placeholder="Brief description">
            </div>
            <div class="form-group">
              <label>Price *</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:16px;font-weight:600;">$</span>
                <input type="text" name="price" required placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
              </div>
            </div>
            <div class="form-group">
              <label>Display Order</label>
              <input type="number" name="display_order" value="0" min="0" style="width:100px;">
              <small style="display:block;margin-top:4px;color:var(--text-muted);">Lower numbers appear first</small>
            </div>
            <button type="submit" style="background:var(--success-color);color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;font-weight:600;">Add Product</button>
          </form>

          ${priceScript}

          <div class="links" style="margin-top:20px;">
            <a href="/admin/products">&larr; Back to Products</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // ── Save New Product ────────────────────────────────────────────────────
  router.post('/save-product', requireAdmin, (req, res) => {
    const { product_name, description, price, display_order } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.send(errorPage('Product name is required.', '/admin/add-product', 'Try Again'));
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.send(errorPage('Valid price is required.', '/admin/add-product', 'Try Again'));
    }

    const formattedPrice = parseFloat(price).toFixed(2);
    const order = parseInt(display_order) || 0;

    db.run('INSERT INTO products (product_name, description, price, display_order) VALUES (?, ?, ?, ?)',
      [product_name.trim(), description || null, formattedPrice, order],
      (err) => {
        if (err) {
          console.error('Error adding product:', err.message);
          return res.send(errorPage('Error adding product. Please try again.', '/admin/add-product', 'Try Again'));
        }
        res.redirect('/admin/products');
      });
  });

  // ── Edit Product Page ───────────────────────────────────────────────────
  router.get('/edit-product/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.get('SELECT * FROM products WHERE product_id = ?', [productId], (err, product) => {
      if (!product) return res.send(errorPage('Product not found.', '/admin/products', 'Back to Products'));

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Product - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

            <h3 class="section-title">Edit Product</h3>

            <form method="POST" action="/admin/update-product/${product.product_id}" style="max-width:600px;">
              <div class="form-group">
                <label>Product Name *</label>
                <input type="text" name="product_name" value="${product.product_name}" required placeholder="Enter product name">
              </div>
              <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" name="description" value="${product.description || ''}" placeholder="Brief description">
              </div>
              <div class="form-group">
                <label>Price *</label>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-size:16px;font-weight:600;">$</span>
                  <input type="text" name="price" value="${product.price ? parseFloat(product.price).toFixed(2) : ''}" required placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                </div>
              </div>
              <div class="form-group">
                <label>Discount Price (Optional)</label>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-size:16px;font-weight:600;">$</span>
                  <input type="text" name="discount_price" value="${product.discount_price ? parseFloat(product.discount_price).toFixed(2) : ''}" placeholder="0.00" style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
                </div>
                <small style="display:block;margin-top:4px;color:var(--text-muted);">If set, the original price will be shown with a line through it.</small>
              </div>
              <div class="form-group">
                <label>Display Order</label>
                <input type="number" name="display_order" value="${product.display_order || 0}" min="0" style="width:100px;">
                <small style="display:block;margin-top:4px;color:var(--text-muted);">Lower numbers appear first</small>
              </div>
              <div class="form-group">
                <label>Availability</label>
                <select name="available">
                  <option value="1" ${product.available ? 'selected' : ''}>Available</option>
                  <option value="0" ${!product.available ? 'selected' : ''}>Sold Out</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="admin_deactivated">
                  <option value="0" ${!product.admin_deactivated ? 'selected' : ''}>Active</option>
                  <option value="1" ${product.admin_deactivated ? 'selected' : ''}>Deactivated</option>
                </select>
                <small style="display:block;margin-top:4px;color:var(--text-muted);">Deactivated products won't appear in the registration interface.</small>
              </div>
              <button type="submit" style="background:var(--success-color);color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;font-weight:600;">Save Changes</button>
            </form>

            ${priceScript}

            <div class="links" style="margin-top:20px;">
              <a href="/admin/products">&larr; Back to Products</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // ── Update Product ──────────────────────────────────────────────────────
  router.post('/update-product/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    const { product_name, description, price, discount_price, display_order, available, admin_deactivated } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.send(errorPage('Product name is required.', `/admin/edit-product/${productId}`, 'Try Again'));
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.send(errorPage('Valid price is required.', `/admin/edit-product/${productId}`, 'Try Again'));
    }

    const formattedPrice = parseFloat(price).toFixed(2);
    const formattedDiscount = discount_price ? parseFloat(discount_price).toFixed(2) : null;
    const order = parseInt(display_order) || 0;
    const isAvailable = available === '1' ? 1 : 0;
    const isDeactivated = admin_deactivated === '1' ? 1 : 0;

    db.run('UPDATE products SET product_name = ?, description = ?, price = ?, discount_price = ?, display_order = ?, available = ?, admin_deactivated = ? WHERE product_id = ?',
      [product_name.trim(), description || null, formattedPrice, formattedDiscount, order, isAvailable, isDeactivated, productId],
      (err) => {
        if (err) {
          console.error('Error updating product:', err.message);
          return res.send(errorPage('Error updating product. Please try again.', `/admin/edit-product/${productId}`, 'Try Again'));
        }
        res.redirect('/admin/products');
      });
  });

  // ── Delete Product ──────────────────────────────────────────────────────
  router.post('/delete-product/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;

    db.run('DELETE FROM products WHERE product_id = ?', [productId], (err) => {
      res.redirect('/admin/products');
    });
  });

  return router;
};
