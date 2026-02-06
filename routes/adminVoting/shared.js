// routes/adminVoting/shared.js - Shared constants and helpers for adminVoting routes

const { styles, adminStyles, getBodyTag, getAppBgStyles } = require('../../views/htmlHelpers');
const { getAvatarContent, getInitials, dashboardHeader } = require('../../views/components');

// Helper: build the admin dashboard header
function adminHeader(user) {
  return dashboardHeader('admin', user, 'Admin Dashboard');
}

// Helper: check if chat is enabled for user
function isChatEnabled(appConfig, user) {
  return appConfig.chatEnabled !== false && user.chat_enabled;
}

// Helper: build admin navigation with Config and Voting subnavs
function getAdminNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/admin/dashboard"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'config' ? ' class="active"' : ''}>Config</a>
      <a href="/admin"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/admin/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'voting' ? ' class="active"' : ''}>Voting</a>
      <a href="/admin/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
      <a href="/user/vote">Vote Here!</a>
      <a href="/admin/reports"${activeTab === 'reports' ? ' class="active"' : ''}>Reports</a>
    </div>`;
}

module.exports = {
  styles,
  adminStyles,
  getBodyTag,
  getAppBgStyles,
  getAvatarContent,
  getInitials,
  adminHeader,
  isChatEnabled,
  getAdminNav
};
