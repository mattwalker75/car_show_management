// routes/vendor/dashboard.js - Vendor dashboard route
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../../middleware/auth');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles, vendorNav,
    vendorStyles, vendorHeader, scrollbarScript, isChatEnabled
  } = require('./shared');

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
              ${business.business_description ? `<p style="margin-top:4px;color:var(--text-dark);font-style:italic;">${business.business_description}</p>` : ''}
            </div>
          </div>
        ` : `<p class="vendor-empty">No business information yet. Click "Edit" to add your business details.</p>`;

        // Products section
        const productsHtml = products.length > 0 ? products.map(p => {
          const soldOut = !p.available;
          const deactivated = p.admin_deactivated;
          return `
          <div class="product-card${deactivated ? '' : (soldOut ? ' sold-out' : '')}"${deactivated ? ' style="opacity:0.6;border-color:var(--deactivated-border);"' : ''}>
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
            <div class="product-info">
              <h5>${p.product_name}${soldOut ? ' - SOLD OUT' : ''}</h5>
              ${deactivated ? `<p style="color:var(--error-color);font-weight:700;font-size:12px;margin-bottom:4px;">Product deactivated by Admin</p>` : ''}
              ${p.description ? `<p>${p.description}</p>` : ''}
              ${p.price ? (p.discount_price
                ? `<p class="product-price"><span style="text-decoration:line-through;color:var(--text-muted);">$${p.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${p.discount_price}</span></p>`
                : `<p class="product-price${soldOut ? ' price-sold-out' : ''}">$${p.price}</p>`
              ) : ''}
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
            ${getAppBgStyles(appConfig)}
            ${vendorStyles}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('dashboard', isChatEnabled(appConfig, user))}

              <div class="welcome-card">
                <h2>Welcome, ${user.name}!</h2>
                <p>Manage your vendor profile and business information.</p>
              </div>

              ${business && business.admin_disabled ? `
              <div style="background:var(--error-bg);border:2px solid var(--btn-delete-bg);border-radius:10px;padding:16px;margin-bottom:16px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:var(--error-color);margin-bottom:4px;">Vendor Store deactivated by Admin</div>
                <div style="font-size:13px;color:var(--error-color);">Your store is currently hidden from other users. Please contact an administrator for more information.</div>
              </div>
              ` : ''}

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
                  ${scrollbarScript}
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

  return router;
};
