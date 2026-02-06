// routes/vendor/shared.js - Shared constants and helpers for vendor routes

const { styles, adminStyles, getBodyTag, getAppBgStyles, escapeHtml } = require('../../views/htmlHelpers');
const { getAvatarContent, vendorNav, isChatEnabled } = require('../../views/components');

// Vendor styles loaded from external CSS file
const vendorStyles = '<link rel="stylesheet" href="/css/vendor.css">';

// Scrollbar script loaded from external JS file
const scrollbarScript = '<script src="/js/vendorScrollbar.js"></script>';

// Price validation script loaded from external JS file
const priceScript = '<script src="/js/priceInput.js"></script>';

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

module.exports = {
  styles,
  adminStyles,
  getBodyTag,
  getAppBgStyles,
  escapeHtml,
  vendorNav,
  vendorStyles,
  vendorHeader,
  scrollbarScript,
  priceScript,
  isChatEnabled
};
