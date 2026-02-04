// routes/admin/vendors.js - Vendor management routes for admin dashboard
const express = require('express');
const path = require('path');
const fs = require('fs');

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

const { requireAdmin } = require('../../middleware/auth');
const { errorPage } = require('../../views/layout');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();

  // Vendor-specific styles
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
        flex-wrap: wrap;
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
      .btn-deactivate { background: #f39c12; color: white; }
      .btn-activate { background: #27ae60; color: white; }
      .btn-disable { background: #e74c3c; color: white; padding: 6px 14px; font-size: 13px; border-radius: 6px; }
      .btn-enable { background: #27ae60; color: white; padding: 6px 14px; font-size: 13px; border-radius: 6px; }
      .product-card.sold-out { opacity: 0.7; }
      .product-card.sold-out h5 { color: #e74c3c; }
      .product-card.deactivated { opacity: 0.5; border-color: #f39c12; }
      .product-card.deactivated h5 { color: #f39c12; }
      .price-sold-out { text-decoration: line-through; }
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
      .vendor-browse-card.store-disabled {
        opacity: 0.6;
        border-color: #e74c3c;
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
      .disabled-badge {
        display: inline-block;
        background: #e74c3c;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        margin-top: 4px;
      }
      .deactivated-badge {
        display: inline-block;
        background: #f39c12;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
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

  // ── Vendor List ────────────────────────────────────────────────
  router.get('/vendors', requireAdmin, async (req, res) => {
    const user = req.session.user;

    try {
      const vendors = await db.allAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE u.role = 'vendor' AND u.is_active = 1
              ORDER BY vb.business_name, u.name`);

      const vendorCards = vendors.length > 0 ? vendors.map(v => {
        const addressParts = [v.business_street, v.business_city, v.business_state].filter(Boolean);
        const addressLine = addressParts.length > 0
          ? (v.business_street ? v.business_street + (v.business_city || v.business_state ? ', ' : '') : '')
            + (v.business_city ? v.business_city + (v.business_state ? ', ' : '') : '')
            + (v.business_state || '')
            + (v.business_zip ? ' ' + v.business_zip : '')
          : '';
        const isDisabled = v.admin_disabled;

        return `
          <a href="/admin/vendors/${v.user_id}" class="vendor-browse-card${isDisabled ? ' store-disabled' : ''}">
            <div class="vendor-browse-image">
              ${v.image_url
                ? `<img src="${v.image_url}" alt="${v.business_name || v.vendor_name}">`
                : `<div class="vendor-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;background:linear-gradient(135deg,#1a1a2e,#16213e);">🏪</div>`
              }
            </div>
            <div class="vendor-browse-info">
              <div class="vendor-browse-name">${v.business_name || v.vendor_name}</div>
              ${v.business_email ? `<div class="vendor-browse-detail">${v.business_email}</div>` : ''}
              ${v.business_phone ? `<div class="vendor-browse-detail">${v.business_phone}</div>` : ''}
              ${addressLine ? `<div class="vendor-browse-detail">${addressLine}</div>` : ''}
              ${v.business_description ? `<div class="vendor-browse-desc">${v.business_description}</div>` : ''}
              ${isDisabled ? `<div class="disabled-badge">Store Disabled</div>` : ''}
            </div>
          </a>`;
      }).join('') : '<p style="color: #666; text-align: center; padding: 20px;">No vendors have registered yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vendors - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
          ${vendorStyles}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('vendors', isChatEnabled(appConfig, user))}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}

            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading vendors: ' + err.message, '/admin/dashboard', 'Back to Dashboard'));
    }
  });

  // ── Vendor Detail ──────────────────────────────────────────────
  router.get('/vendors/:id', requireAdmin, async (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.id;

    try {
      const business = await db.getAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId]);

      if (!business) return res.redirect('/admin/vendors');

      const products = await db.allAsync('SELECT * FROM vendor_products WHERE user_id = ? ORDER BY display_order, product_id', [vendorUserId]);

      const addressParts = [business.business_street, business.business_city, business.business_state].filter(Boolean);
      const addressLine = addressParts.length > 0
        ? (business.business_street ? business.business_street + (business.business_city || business.business_state ? ', ' : '') : '')
          + (business.business_city ? business.business_city + (business.business_state ? ', ' : '') : '')
          + (business.business_state || '')
          + (business.business_zip ? ' ' + business.business_zip : '')
        : '';

      const isDisabled = business.admin_disabled;

      const productsHtml = products.length > 0 ? products.map(p => {
        const soldOut = !p.available;
        const deactivated = p.admin_deactivated;
        let cardClass = '';
        if (deactivated) cardClass = ' deactivated';
        else if (soldOut) cardClass = ' sold-out';

        return `
        <a href="/admin/vendors/${vendorUserId}/product/${p.product_id}" class="product-card-link" style="text-decoration:none;color:inherit;display:block;">
          <div class="product-card${cardClass}">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.product_name}">` : ''}
            <div class="product-info">
              <h5>${p.product_name}${deactivated ? ' - DEACTIVATED' : (soldOut ? ' - SOLD OUT' : '')}${deactivated ? '<span class="deactivated-badge">Admin Deactivated</span>' : ''}</h5>
              ${p.description ? `<p>${p.description}</p>` : ''}
              ${p.price ? (p.discount_price
                ? `<p style="font-weight:600;color:#e94560;"><span style="text-decoration:line-through;color:#999;">$${p.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${p.discount_price}</span></p>`
                : `<p style="font-weight:600;color:#e94560;${soldOut ? 'text-decoration:line-through;' : ''}">$${p.price}</p>`
              ) : ''}
              <div class="product-actions">
                ${deactivated
                  ? `<a href="#" onclick="if(confirm('Reactivate this product?'))document.getElementById('activateProd${p.product_id}').submit();return false;" class="btn-sm btn-activate">Reactivate</a>`
                  : `<a href="#" onclick="if(confirm('Deactivate this product? It will be hidden from all users except the vendor and admin.'))document.getElementById('deactivateProd${p.product_id}').submit();return false;" class="btn-sm btn-deactivate">Deactivate</a>`
                }
                <a href="#" onclick="if(confirm('Permanently delete this product? This cannot be undone.'))document.getElementById('delProd${p.product_id}').submit();return false;" class="btn-sm btn-delete">Delete</a>
                <form id="deactivateProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/deactivate-product/${p.product_id}" style="display:none;"></form>
                <form id="activateProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/activate-product/${p.product_id}" style="display:none;"></form>
                <form id="delProd${p.product_id}" method="POST" action="/admin/vendors/${vendorUserId}/delete-product/${p.product_id}" style="display:none;"></form>
              </div>
            </div>
          </div>
        </a>`;
      }).join('') : '<p style="color:#888;font-style:italic;">No products or services listed yet.</p>';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${business.business_name || business.vendor_name} - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
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
            .store-status-banner {
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 16px;
              font-weight: 600;
              text-align: center;
              font-size: 14px;
            }
            .store-status-banner.disabled {
              background: #fde8e8;
              color: #e74c3c;
              border: 1px solid #e74c3c;
            }
            .store-status-banner.active {
              background: #e8f5e9;
              color: #27ae60;
              border: 1px solid #27ae60;
            }
            .product-card-link { text-decoration: none; color: inherit; display: block; }
            .product-card-link:active .product-card { background: #eef; }
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
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('vendors', isChatEnabled(appConfig, user))}

            ${isDisabled ? `
              <div class="store-status-banner disabled">
                Store Disabled by Admin — Hidden from all users
                <form method="POST" action="/admin/vendors/${vendorUserId}/enable-store" style="display:inline;margin-left:12px;">
                  <button type="submit" class="btn-enable" onclick="return confirm('Re-enable this vendor store?')">Enable Store</button>
                </form>
              </div>
            ` : `
              <div class="store-status-banner active">
                Store Active — Visible to all users
                <form method="POST" action="/admin/vendors/${vendorUserId}/disable-store" style="display:inline;margin-left:12px;">
                  <button type="submit" class="btn-disable" onclick="return confirm('Disable this entire vendor store? It will be hidden from all users.')">Disable Store</button>
                </form>
              </div>
            `}

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
              <h4>Products &amp; Services (${products.length})</h4>
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
              <a href="/admin/vendors">&larr; Back to Vendors</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading vendor: ' + err.message, '/admin/vendors', 'Back to Vendors'));
    }
  });

  // ── Vendor Product Detail ──────────────────────────────────────
  router.get('/vendors/:vendorId/product/:productId', requireAdmin, async (req, res) => {
    const user = req.session.user;
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      const business = await db.getAsync(`SELECT vb.*, u.name as vendor_name
              FROM vendor_business vb
              JOIN users u ON vb.user_id = u.user_id
              WHERE vb.user_id = ? AND u.role = 'vendor' AND u.is_active = 1`, [vendorUserId]);

      if (!business) return res.redirect('/admin/vendors');

      const product = await db.getAsync('SELECT * FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
      if (!product) return res.redirect(`/admin/vendors/${vendorUserId}`);

      const soldOut = !product.available;
      const deactivated = product.admin_deactivated;
      const businessName = business.business_name || business.vendor_name;

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${product.product_name} - ${businessName} - Admin Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
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
            .product-detail-name.deactivated {
              color: #f39c12;
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
            .product-detail-status.deactivated {
              background: #fff3cd;
              color: #856404;
            }
            .admin-actions {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e1e1e1;
            }
            @media (min-width: 768px) {
              .product-detail-name { font-size: 26px; }
              .product-detail-price { font-size: 24px; }
            }
          </style>
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('vendors', isChatEnabled(appConfig, user))}

            ${product.image_url ? `
            <div class="product-detail-image">
              <img src="${product.image_url}" alt="${product.product_name}">
            </div>
            ` : ''}

            <div class="product-detail-name${deactivated ? ' deactivated' : (soldOut ? ' sold-out' : '')}">${product.product_name}${deactivated ? ' - DEACTIVATED' : (soldOut ? ' - SOLD OUT' : '')}</div>
            <div class="product-detail-vendor">by ${businessName}</div>

            ${deactivated
              ? `<span class="product-detail-status deactivated">Deactivated by Admin</span>`
              : `<span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>`
            }

            ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
            ${product.price ? (product.discount_price
              ? `<div class="product-detail-price"><span style="text-decoration:line-through;color:#999;font-size:0.8em;">$${product.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${product.discount_price}</span></div>`
              : `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>`
            ) : ''}

            <div class="admin-actions">
              ${deactivated
                ? `<form method="POST" action="/admin/vendors/${vendorUserId}/activate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-activate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Reactivate this product?')">Reactivate Product</button>
                  </form>`
                : `<form method="POST" action="/admin/vendors/${vendorUserId}/deactivate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-deactivate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Deactivate this product?')">Deactivate Product</button>
                  </form>`
              }
              <form method="POST" action="/admin/vendors/${vendorUserId}/delete-product/${product.product_id}" style="display:inline;">
                <button type="submit" class="btn-sm btn-delete" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Permanently delete this product? This cannot be undone.')">Delete Product</button>
              </form>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.send(errorPage('Error loading product: ' + err.message, `/admin/vendors/${vendorUserId}`, 'Back to Vendor'));
    }
  });

  // ── Admin: Deactivate Product ──────────────────────────────────
  router.post('/vendors/:vendorId/deactivate-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      await db.runAsync('UPDATE vendor_products SET admin_deactivated = 1 WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Reactivate Product ──────────────────────────────────
  router.post('/vendors/:vendorId/activate-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      await db.runAsync('UPDATE vendor_products SET admin_deactivated = 0 WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Delete Product ──────────────────────────────────────
  router.post('/vendors/:vendorId/delete-product/:productId', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;
    const productId = req.params.productId;

    try {
      const product = await db.getAsync('SELECT image_url FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
      if (product && product.image_url) {
        const imagePath = path.join(__dirname, '../..', product.image_url);
        fs.unlink(imagePath, () => {});
      }
      await db.runAsync('DELETE FROM vendor_products WHERE product_id = ? AND user_id = ?', [productId, vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Disable Store ───────────────────────────────────────
  router.post('/vendors/:vendorId/disable-store', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;

    try {
      await db.runAsync('UPDATE vendor_business SET admin_disabled = 1 WHERE user_id = ?', [vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  // ── Admin: Enable Store ────────────────────────────────────────
  router.post('/vendors/:vendorId/enable-store', requireAdmin, async (req, res) => {
    const vendorUserId = req.params.vendorId;

    try {
      await db.runAsync('UPDATE vendor_business SET admin_disabled = 0 WHERE user_id = ?', [vendorUserId]);
    } catch (err) { /* ignore */ }
    res.redirect(`/admin/vendors/${vendorUserId}`);
  });

  return router;
};
