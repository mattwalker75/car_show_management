// helpers/vendorViews.js - Shared vendor browse rendering helpers
// Extracts duplicate vendor list, detail, and product detail page rendering
// used across admin, judge, registrar, user, and vendor route files.

const { getAppBackgroundStyles } = require('../views/layout');

// ── Shared constants ────────────────────────────────────────────
const styles = '<link rel="stylesheet" href="/css/styles.css">';
const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';

/**
 * Build the body tag with data attributes from the user session.
 * @param {Object} user - User object with role, user_id, name, image_url
 * @returns {string} Opening <body> tag with data attributes
 */
function buildBodyTag(user) {
  return `<body data-user-role="${user ? user.role : ''}" data-user-id="${user ? user.user_id : ''}" data-user-name="${user ? user.name : ''}" data-user-image="${user && user.image_url ? user.image_url : ''}">`;
}

/**
 * Format an address line from business fields.
 * @param {Object} biz - Business object with business_street, business_city, business_state, business_zip
 * @returns {string} Formatted address string or empty string
 */
function formatAddressLine(biz) {
  const addressParts = [biz.business_street, biz.business_city, biz.business_state].filter(Boolean);
  if (addressParts.length === 0) return '';
  return (biz.business_street ? biz.business_street + (biz.business_city || biz.business_state ? ', ' : '') : '')
    + (biz.business_city ? biz.business_city + (biz.business_state ? ', ' : '') : '')
    + (biz.business_state || '')
    + (biz.business_zip ? ' ' + biz.business_zip : '');
}

/**
 * Custom scrollbar script for the products scroll wrapper.
 * Identical to the inline script used in both admin.js and judge.js.
 * @returns {string} <script> block
 */
function scrollbarScript() {
  return `
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
    </script>`;
}

// ── CSS Helpers ─────────────────────────────────────────────────

/**
 * Returns the full shared CSS <style> block used across all vendor browse pages.
 * Includes vendor-browse-card, product-card, vendor-section, vendor-detail,
 * scrollbar, admin badges, admin buttons, and responsive rules.
 * @returns {string} <style> block
 */
function vendorBrowseStyles() {
  return `
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
      .product-card-link { text-decoration: none; color: inherit; display: block; }
      .product-card-link:active .product-card { background: #eef; }
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
        .product-card-link:hover .product-card { border-color: #e94560; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      }
    </style>`;
}

/**
 * Returns the vendor detail page specific CSS (header, booth, status banner).
 * Used on the vendor detail and product detail pages.
 * @param {boolean} isAdmin - Whether to include admin-specific styles
 * @returns {string} <style> block
 */
function vendorDetailStyles(isAdmin) {
  return `
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
      ${isAdmin ? `
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
      }` : ''}
      @media (min-width: 768px) {
        .vendor-detail-image {
          width: 120px;
          height: 120px;
        }
        .vendor-detail-info h3 {
          font-size: 22px;
        }
      }
    </style>`;
}

/**
 * Returns the product detail page specific CSS.
 * @param {boolean} isAdmin - Whether to include admin-specific styles (deactivated status)
 * @returns {string} <style> block
 */
function productDetailStyles(isAdmin) {
  return `
    <style>
      .product-detail-image { width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; margin: 0 auto 20px; border: 2px solid #e1e1e1; }
      .product-detail-image img { width: 100%; display: block; }
      .product-detail-name { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
      .product-detail-name.sold-out { color: #e74c3c; }
      ${isAdmin ? `.product-detail-name.deactivated { color: #f39c12; }` : ''}
      .product-detail-vendor { font-size: 14px; color: #888; margin-bottom: 16px; }
      .product-detail-desc { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px; }
      .product-detail-price { font-size: 20px; font-weight: 700; color: #e94560; margin-bottom: 8px; }
      .product-detail-price.sold-out { text-decoration: line-through; }
      .product-detail-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
      .product-detail-status.available { background: #e8f5e9; color: #27ae60; }
      .product-detail-status.sold-out { background: #fde8e8; color: #e74c3c; }
      ${isAdmin ? `.product-detail-status.deactivated { background: #fff3cd; color: #856404; }
      .admin-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e1e1e1;
      }` : ''}
      @media (min-width: 768px) {
        .product-detail-name { font-size: 26px; }
        .product-detail-price { font-size: 24px; }
      }
    </style>`;
}

// ── Page Renderers ──────────────────────────────────────────────

/**
 * Render the vendor browse list page.
 *
 * @param {Object} options
 * @param {Array}  options.vendors   - Array of vendor business rows (joined with users)
 * @param {Object} options.user      - Current session user
 * @param {string} options.role      - Current user role ('admin', 'judge', 'registrar', 'user', 'vendor')
 * @param {Object} options.appConfig - App configuration object
 * @param {string} options.nav       - Pre-rendered navigation HTML
 * @param {string} options.header    - Pre-rendered dashboard header HTML
 * @param {boolean} options.isAdmin  - Whether to show admin controls (disabled badge, etc.)
 * @returns {string} Full HTML page
 */
function renderVendorListPage({ vendors, user, role, appConfig, nav, header, isAdmin }) {
  const linkPrefix = `/${role}/vendors/`;

  const vendorCards = vendors.length > 0 ? vendors.map(v => {
    const addressLine = formatAddressLine(v);
    const isDisabled = isAdmin && v.admin_disabled;

    return `
          <a href="${linkPrefix}${v.user_id}" class="vendor-browse-card${isDisabled ? ' store-disabled' : ''}">
            <div class="vendor-browse-image">
              ${v.image_url
                ? `<img src="${v.image_url}" alt="${v.business_name || v.vendor_name}">`
                : `<div class="vendor-placeholder">&#127978;</div>`
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

  const appBg = getAppBackgroundStyles(appConfig);
  const pageTitle = appConfig.appTitle || 'Car Show Manager';

  return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vendors - ${pageTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBg}
          ${vendorBrowseStyles()}
        </head>
        ${buildBodyTag(user)}
          <div class="container dashboard-container">
            ${header}

            ${nav}

            <h3 class="section-title">Vendors (${vendors.length})</h3>

            ${vendorCards}

            ${isAdmin ? `
            <div class="links" style="margin-top:20px;">
              <a href="/${role}/dashboard">&larr; Back to Dashboard</a>
            </div>` : ''}
          </div>
        </body>
        </html>
      `;
}

/**
 * Render the vendor detail page with business info and product cards.
 *
 * @param {Object} options
 * @param {Object}  options.business  - Vendor business row (joined with users)
 * @param {Array}   options.products  - Array of vendor_products rows
 * @param {Object}  options.user      - Current session user
 * @param {string}  options.role      - Current user role
 * @param {Object}  options.appConfig - App configuration object
 * @param {string}  options.nav       - Pre-rendered navigation HTML
 * @param {string}  options.header    - Pre-rendered dashboard header HTML
 * @param {boolean} options.isAdmin   - Whether to show admin controls
 * @returns {string} Full HTML page
 */
function renderVendorDetailPage({ business, products, user, role, appConfig, nav, header, isAdmin }) {
  const vendorUserId = business.user_id;
  const linkPrefix = `/${role}/vendors/`;
  const addressLine = formatAddressLine(business);
  const isDisabled = isAdmin && business.admin_disabled;

  const productsHtml = products.length > 0 ? products.map(p => {
    const soldOut = !p.available;
    const deactivated = isAdmin && p.admin_deactivated;

    if (isAdmin) {
      let cardClass = '';
      if (deactivated) cardClass = ' deactivated';
      else if (soldOut) cardClass = ' sold-out';

      return `
        <a href="${linkPrefix}${vendorUserId}/product/${p.product_id}" class="product-card-link" style="text-decoration:none;color:inherit;display:block;">
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
                <form id="deactivateProd${p.product_id}" method="POST" action="/${role}/vendors/${vendorUserId}/deactivate-product/${p.product_id}" style="display:none;"></form>
                <form id="activateProd${p.product_id}" method="POST" action="/${role}/vendors/${vendorUserId}/activate-product/${p.product_id}" style="display:none;"></form>
                <form id="delProd${p.product_id}" method="POST" action="/${role}/vendors/${vendorUserId}/delete-product/${p.product_id}" style="display:none;"></form>
              </div>
            </div>
          </div>
        </a>`;
    } else {
      return `
          <a href="${linkPrefix}${vendorUserId}/product/${p.product_id}" class="product-card-link">
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
    }
  }).join('') : '<p style="color:#888;font-style:italic;">No products or services listed yet.</p>';

  const appBg = getAppBackgroundStyles(appConfig);
  const productsTitle = isAdmin ? `Products &amp; Services (${products.length})` : 'Products &amp; Services';
  const pageTitle = appConfig.appTitle || 'Car Show Manager';

  // Store status banner (admin only)
  const storeStatusBanner = isAdmin ? (isDisabled ? `
            <div class="store-status-banner disabled">
              Store Disabled by Admin &mdash; Hidden from all users
              <form method="POST" action="/${role}/vendors/${vendorUserId}/enable-store" style="display:inline;margin-left:12px;">
                <button type="submit" class="btn-enable" onclick="return confirm('Re-enable this vendor store?')">Enable Store</button>
              </form>
            </div>
          ` : `
            <div class="store-status-banner active">
              Store Active &mdash; Visible to all users
              <form method="POST" action="/${role}/vendors/${vendorUserId}/disable-store" style="display:inline;margin-left:12px;">
                <button type="submit" class="btn-disable" onclick="return confirm('Disable this entire vendor store? It will be hidden from all users.')">Disable Store</button>
              </form>
            </div>
          `) : '';

  return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${business.business_name || business.vendor_name} - ${pageTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBg}
          ${vendorBrowseStyles()}
          ${vendorDetailStyles(isAdmin)}
        </head>
        ${buildBodyTag(user)}
          <div class="container dashboard-container">
            ${header}

            ${nav}

            ${storeStatusBanner}

            <div class="vendor-detail-header">
              <div class="vendor-detail-image"${business.image_url ? ` style="cursor:pointer;" onclick="openImageModal(this.querySelector('img').src, this.querySelector('img').alt)"` : ''}>
                ${business.image_url
                  ? `<img src="${business.image_url}" alt="${(business.business_name || business.vendor_name).replace(/"/g, '&quot;')}">`
                  : `<div class="vendor-detail-placeholder">&#127978;</div>`
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
              <h4>${productsTitle}</h4>
              ${products.length > 3 ? `
                <div class="products-scroll-wrapper">
                  <div class="products-scroll" id="productsScroll">${productsHtml}</div>
                  <div class="custom-scrollbar-track" id="scrollTrack">
                    <div class="custom-scrollbar-thumb" id="scrollThumb"></div>
                  </div>
                </div>
                ${scrollbarScript()}
              ` : productsHtml}
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/${role}/vendors">&larr; Back to Vendors</a>
            </div>
          </div>
          ${business.image_url ? `
          <div class="image-modal" id="imageModal" onclick="closeImageModal()">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <img id="modalImage" src="" alt="">
          </div>
          <script>
            function openImageModal(src, alt) {
              var modal = document.getElementById('imageModal');
              var img = document.getElementById('modalImage');
              img.src = src;
              img.alt = alt || '';
              modal.classList.add('active');
              document.body.style.overflow = 'hidden';
            }
            function closeImageModal() {
              var modal = document.getElementById('imageModal');
              modal.classList.remove('active');
              document.body.style.overflow = '';
            }
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') closeImageModal();
            });
          </script>
          ` : ''}
        </body>
        </html>
      `;
}

/**
 * Render the individual product detail page.
 *
 * @param {Object} options
 * @param {Object}  options.product   - vendor_products row
 * @param {Object}  options.business  - Vendor business row (joined with users)
 * @param {Object}  options.user      - Current session user
 * @param {string}  options.role      - Current user role
 * @param {Object}  options.appConfig - App configuration object
 * @param {string}  options.nav       - Pre-rendered navigation HTML
 * @param {string}  options.header    - Pre-rendered dashboard header HTML
 * @param {boolean} options.isAdmin   - Whether to show admin controls
 * @returns {string} Full HTML page
 */
function renderProductDetailPage({ product, business, user, role, appConfig, nav, header, isAdmin }) {
  const vendorUserId = business.user_id;
  const soldOut = !product.available;
  const deactivated = isAdmin && product.admin_deactivated;
  const businessName = business.business_name || business.vendor_name;

  const appBg = getAppBackgroundStyles(appConfig);

  // Name class: deactivated > sold-out > normal
  let nameClass = '';
  if (deactivated) nameClass = ' deactivated';
  else if (soldOut) nameClass = ' sold-out';

  // Name suffix
  let nameSuffix = '';
  if (deactivated) nameSuffix = ' - DEACTIVATED';
  else if (soldOut) nameSuffix = ' - SOLD OUT';

  // Status badge
  let statusBadge;
  if (deactivated) {
    statusBadge = `<span class="product-detail-status deactivated">Deactivated by Admin</span>`;
  } else {
    statusBadge = `<span class="product-detail-status ${soldOut ? 'sold-out' : 'available'}">${soldOut ? 'Sold Out' : 'Available'}</span>`;
  }

  // Admin action buttons
  const adminActions = isAdmin ? `
            <div class="admin-actions">
              ${deactivated
                ? `<form method="POST" action="/${role}/vendors/${vendorUserId}/activate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-activate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Reactivate this product?')">Reactivate Product</button>
                  </form>`
                : `<form method="POST" action="/${role}/vendors/${vendorUserId}/deactivate-product/${product.product_id}" style="display:inline;">
                    <button type="submit" class="btn-sm btn-deactivate" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Deactivate this product?')">Deactivate Product</button>
                  </form>`
              }
              <form method="POST" action="/${role}/vendors/${vendorUserId}/delete-product/${product.product_id}" style="display:inline;">
                <button type="submit" class="btn-sm btn-delete" style="padding:8px 16px;font-size:14px;" onclick="return confirm('Permanently delete this product? This cannot be undone.')">Delete Product</button>
              </form>
            </div>` : '';

  const pageTitleText = `${product.product_name} - ${businessName} - ${appConfig.appTitle || 'Car Show Manager'}`;

  return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${pageTitleText}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${appBg}
          ${vendorBrowseStyles()}
          ${productDetailStyles(isAdmin)}
        </head>
        ${buildBodyTag(user)}
          <div class="container dashboard-container">
            ${header}

            ${nav}

            ${product.image_url ? `<div class="product-detail-image"><img src="${product.image_url}" alt="${product.product_name}"></div>` : ''}

            <div class="product-detail-name${nameClass}">${product.product_name}${nameSuffix}</div>
            <div class="product-detail-vendor">by ${businessName}</div>

            ${statusBadge}

            ${product.description ? `<div class="product-detail-desc">${product.description}</div>` : ''}
            ${product.price ? (product.discount_price
              ? `<div class="product-detail-price"><span style="text-decoration:line-through;color:#999;font-size:0.8em;">$${product.price}</span> <span${soldOut ? ' style="text-decoration:line-through;"' : ''}>$${product.discount_price}</span></div>`
              : `<div class="product-detail-price${soldOut ? ' sold-out' : ''}">$${product.price}</div>`
            ) : ''}

            ${adminActions}

            <div class="links" style="margin-top:20px;">
              <a href="/${role}/vendors/${vendorUserId}">&larr; Back to ${businessName}</a>
            </div>
          </div>
        </body>
        </html>
      `;
}

module.exports = {
  vendorBrowseStyles,
  vendorDetailStyles,
  productDetailStyles,
  renderVendorListPage,
  renderVendorDetailPage,
  renderProductDetailPage,
  formatAddressLine,
  buildBodyTag,
  scrollbarScript
};
