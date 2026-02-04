// views/htmlHelpers.js - Centralized HTML constants and helpers
// Eliminates duplication of styles, scripts, and body tag generation across route files

const { getAppBackgroundStyles } = require('./layout');

// ── CSS Link Tags ──────────────────────────────────────────────────────────
const styles = '<link rel="stylesheet" href="/css/styles.css">';
const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';

// ── Body Tag Generator ─────────────────────────────────────────────────────
/**
 * Generate opening body tag with user data attributes for client-side JS.
 * @param {Object} req - Express request object with session
 * @returns {string} Opening <body> tag with data attributes
 */
function getBodyTag(req) {
  const u = req.session && req.session.user;
  return `<body data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`;
}

// ── App Background Styles ──────────────────────────────────────────────────
/**
 * Generate dynamic app background styles from config.
 * @param {Object} appConfig - Application configuration object
 * @returns {string} <style> tag with background CSS
 */
function getAppBgStyles(appConfig) {
  return getAppBackgroundStyles(appConfig);
}

module.exports = {
  styles,
  adminStyles,
  getBodyTag,
  getAppBgStyles
};
