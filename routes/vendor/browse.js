// routes/vendor/browse.js - Vendor browsing routes (view other vendors)
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../../middleware/auth');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles, vendorNav,
    vendorStyles, vendorHeader, scrollbarScript, isChatEnabled
  } = require('./shared');

  // Browse styles (additional styles for vendor browsing)
  const browseStyles = `
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
      .vendor-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
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
  `;

  // Detail styles (for vendor detail page)
  const detailStyles = `
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
  `;

  // Product detail styles
  const productDetailStyles = `
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
  `;

  // Helper: format address line
  function formatAddressLine(biz) {
    const parts = [biz.business_street, biz.business_city, biz.business_state].filter(Boolean);
    if (parts.length === 0) return '';
    return (biz.business_street ? biz.business_street + (biz.business_city || biz.business_state ? ', ' : '') : '')
      + (biz.business_city ? biz.business_city + (biz.business_state ? ', ' : '') : '')
      + (biz.business_state || '')
      + (biz.business_zip ? ' ' + biz.business_zip : '');
  }

  // Vendors list
  router.get('/vendors', requireVendor, (req, res) => {
    const user = req.session.user;

    db.all(`SELECT vb.*, u.name as vendor_name
            FROM vendor_business vb
            JOIN users u ON vb.user_id = u.user_id
            WHERE u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)
            ORDER BY vb.business_name, u.name`, (err, vendors) => {
      if (err) vendors = [];

      const vendorCards = vendors.length > 0 ? vendors.map(v => {
        const addressLine = formatAddressLine(v);

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
          ${getAppBgStyles(appConfig)}
          ${vendorStyles}
          ${browseStyles}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${vendorHeader(user)}
            ${vendorNav('vendors', isChatEnabled(appConfig, user))}

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
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) {
        res.redirect('/vendor/vendors');
        return;
      }

      db.all('SELECT * FROM vendor_products WHERE user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL) ORDER BY display_order, product_id', [vendorUserId], (err2, products) => {
        if (!products) products = [];

        const addressLine = formatAddressLine(business);

        const productsHtml = products.length > 0 ? products.map(p => {
          const soldOut = !p.available;
          return `
          <a href="/vendor/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link">
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
            <title>${business.business_name || business.vendor_name} - ${appConfig.appTitle || 'Car Show Manager'}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
            ${vendorStyles}
            ${detailStyles}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('vendors', isChatEnabled(appConfig, user))}

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
                  ${scrollbarScript}
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
            WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1 AND (vb.admin_disabled = 0 OR vb.admin_disabled IS NULL)`, [vendorUserId], (err, business) => {
      if (err || !business) return res.redirect('/vendor/vendors');

      db.get('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ? AND (admin_deactivated = 0 OR admin_deactivated IS NULL)', [productId, vendorUserId], (err2, product) => {
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
            ${getAppBgStyles(appConfig)}
            ${vendorStyles}
            ${productDetailStyles}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${vendorHeader(user)}
              ${vendorNav('vendors', isChatEnabled(appConfig, user))}

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
