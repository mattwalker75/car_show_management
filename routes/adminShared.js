// routes/adminShared.js - Shared constants and helpers for all admin routes
// Consolidates admin, adminConfig, and adminVoting shared modules

const { styles, adminStyles, getBodyTag, getAppBgStyles, escapeHtml } = require('../views/htmlHelpers');
const { getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav, profileButton } = require('../views/components');

module.exports = {
  styles,
  adminStyles,
  getBodyTag,
  getAppBgStyles,
  escapeHtml,
  getAvatarContent,
  getInitials,
  adminHeader,
  isChatEnabled,
  getAdminNav,
  profileButton
};
