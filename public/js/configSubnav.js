// configSubnav.js - Admin config and voting sub-navigation toggles
// Dynamically creates the config and voting sub-navigation bars under their
// respective tabs and highlights the active page.

document.addEventListener('DOMContentLoaded', function() {
  var navs = document.querySelectorAll('.admin-nav');
  if (navs.length > 0) {
    var nav = navs[0];
    var path = window.location.pathname;

    // Config sub-nav
    var configToggle = nav.querySelector('a[onclick*="configSubnav"]');
    if (configToggle) {
      var subnav = document.createElement('div');
      subnav.id = 'configSubnav';
      subnav.className = 'admin-nav config-subnav';
      var isConfigPage = path.startsWith('/admin/app-config') || path.startsWith('/admin/vehicle-config') || path.startsWith('/admin/categories') || path.startsWith('/admin/specialty-vote') || path.startsWith('/admin/edit-category') || path.startsWith('/admin/category-questions') || path.startsWith('/admin/edit-question') || path.startsWith('/admin/add-vehicle-type') || path.startsWith('/admin/edit-vehicle-type') || path.startsWith('/admin/add-class') || path.startsWith('/admin/edit-class') || path.startsWith('/admin/edit-specialty-vote') || path.startsWith('/admin/add-specialty-vote') || path.startsWith('/admin/products') || path.startsWith('/admin/add-product') || path.startsWith('/admin/edit-product');
      subnav.style.display = isConfigPage ? 'flex' : 'none';
      subnav.innerHTML = '<a href="/admin/app-config"' + (path.startsWith('/admin/app-config') ? ' class="active"' : '') + '>Application</a>' +
        '<a href="/admin/vehicle-config"' + (path.startsWith('/admin/vehicle-config') || path.startsWith('/admin/add-vehicle-type') || path.startsWith('/admin/edit-vehicle-type') || path.startsWith('/admin/add-class') || path.startsWith('/admin/edit-class') ? ' class="active"' : '') + '>Vehicle Config</a>' +
        '<a href="/admin/categories"' + (path.startsWith('/admin/categories') || path.startsWith('/admin/edit-category') || path.startsWith('/admin/category-questions') || path.startsWith('/admin/edit-question') ? ' class="active"' : '') + '>Judge</a>' +
        '<a href="/admin/specialty-votes"' + (path.startsWith('/admin/specialty-vote') || path.startsWith('/admin/edit-specialty-vote') || path.startsWith('/admin/add-specialty-vote') ? ' class="active"' : '') + '>Special Vote</a>' +
        '<a href="/admin/products"' + (path.startsWith('/admin/products') || path.startsWith('/admin/add-product') || path.startsWith('/admin/edit-product') ? ' class="active"' : '') + '>Products</a>';
      nav.parentNode.insertBefore(subnav, nav.nextSibling);
    }

    // Voting sub-nav
    var votingToggle = nav.querySelector('a[onclick*="votingSubnav"]');
    if (votingToggle) {
      var vsubnav = document.createElement('div');
      vsubnav.id = 'votingSubnav';
      vsubnav.className = 'admin-nav config-subnav';
      var isVotingPage = path.startsWith('/admin/judge-status') || path.startsWith('/admin/edit-judge-scores') || path.startsWith('/admin/save-judge-scores') || path.startsWith('/admin/preview-judge-results') || path.startsWith('/admin/lock-judge-voting') || path.startsWith('/admin/open-judge-voting') || path.startsWith('/admin/close-judge-voting') || path.startsWith('/admin/vote-status') || path.startsWith('/admin/edit-vote-results') || path.startsWith('/admin/delete-vote-result') || path.startsWith('/admin/preview-vote-results') || path.startsWith('/admin/lock-specialty-voting') || path.startsWith('/admin/open-specialty-voting') || path.startsWith('/admin/close-specialty-voting');
      vsubnav.style.display = isVotingPage ? 'flex' : 'none';
      vsubnav.innerHTML = '<a href="/admin/judge-status"' + (path.startsWith('/admin/judge-status') || path.startsWith('/admin/edit-judge-scores') || path.startsWith('/admin/save-judge-scores') || path.startsWith('/admin/preview-judge-results') || path.startsWith('/admin/lock-judge-voting') || path.startsWith('/admin/open-judge-voting') || path.startsWith('/admin/close-judge-voting') ? ' class="active"' : '') + '>Judge Status</a>' +
        '<a href="/admin/vote-status"' + (path.startsWith('/admin/vote-status') || path.startsWith('/admin/edit-vote-results') || path.startsWith('/admin/delete-vote-result') || path.startsWith('/admin/preview-vote-results') || path.startsWith('/admin/lock-specialty-voting') || path.startsWith('/admin/open-specialty-voting') || path.startsWith('/admin/close-specialty-voting') ? ' class="active"' : '') + '>Vote Status</a>';

      // Insert after config subnav if it exists, otherwise after nav
      var configSubnavEl = document.getElementById('configSubnav');
      var insertAfter = configSubnavEl || nav;
      insertAfter.parentNode.insertBefore(vsubnav, insertAfter.nextSibling);
    }
  }
});
