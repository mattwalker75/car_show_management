// routes/vendor/shared.js - Shared constants and helpers for vendor routes

const { styles, adminStyles, getBodyTag, getAppBgStyles } = require('../../views/htmlHelpers');
const { getAvatarContent, vendorNav } = require('../../views/components');

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

// Custom scrollbar script for products scroll
const scrollbarScript = `
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
`;

// Price validation script for forms
const priceScript = `
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

// Helper: check if chat is enabled for user
function isChatEnabled(appConfig, user) {
  return appConfig.chatEnabled !== false && user.chat_enabled;
}

module.exports = {
  styles,
  adminStyles,
  getBodyTag,
  getAppBgStyles,
  vendorNav,
  vendorStyles,
  vendorHeader,
  scrollbarScript,
  priceScript,
  isChatEnabled
};
