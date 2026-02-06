// views/htmlHelpers.js - Centralized HTML constants and helpers
// Eliminates duplication of styles, scripts, and body tag generation across route files

const { getAppBackgroundStyles } = require('./layout');

// ── HTML Escape Helper ─────────────────────────────────────────────────────
/**
 * Escape HTML special characters to prevent XSS attacks.
 * Use this when inserting user-provided data into HTML templates.
 * @param {string} text - The text to escape
 * @returns {string} The escaped text safe for HTML insertion
 */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

// ── CSS Link Tags ──────────────────────────────────────────────────────────
const styles = '<link rel="stylesheet" href="/css/styles.css">';
const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';

// ── Body Tag Generator ─────────────────────────────────────────────────────
/**
 * Generate opening body tag with user data attributes for client-side JS.
 * @param {Object} req - Express request object with session
 * @param {Object} [appConfigParam] - Application configuration object (optional)
 * @returns {string} Opening <body> tag with data attributes
 */
function getBodyTag(req, appConfigParam) {
  const u = req.session && req.session.user;
  // Use passed config or fallback to require (for backwards compatibility)
  const config = appConfigParam || require('../config/appConfig').appConfig;
  const theme = config.theme || 'light';
  // Escape user data to prevent XSS via malicious names/image URLs
  return `<body data-theme="${theme}" data-user-role="${u ? escapeHtml(u.role) : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? escapeHtml(u.name) : ''}" data-user-image="${u && u.image_url ? escapeHtml(u.image_url) : ''}">`;
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
  getAppBgStyles,
  escapeHtml
};
