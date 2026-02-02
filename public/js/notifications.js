// notifications.js - Real-time toast notifications via Socket.io
// Reads user role from <body data-user-role="...">, connects to Socket.io,
// joins role-based rooms, and displays toast notifications.
document.addEventListener('DOMContentLoaded', function () {
  var role = document.body.getAttribute('data-user-role');
  if (!role) return;

  // Create toast container
  var container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);

  // Inject toast CSS
  var style = document.createElement('style');
  style.textContent =
    '#toast-container {' +
    '  position: fixed; top: 16px; right: 16px; z-index: 99999;' +
    '  display: flex; flex-direction: column; gap: 10px;' +
    '  max-width: 360px; width: calc(100% - 32px); pointer-events: none;' +
    '}' +
    '.toast {' +
    '  background: #1a1a2e; color: #fff; padding: 14px 18px;' +
    '  border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);' +
    '  font-size: 14px; line-height: 1.4; border-left: 4px solid #e94560;' +
    '  opacity: 0; transform: translateX(100%);' +
    '  transition: opacity 0.3s ease, transform 0.3s ease;' +
    '  pointer-events: auto; cursor: pointer;' +
    '}' +
    '.toast.show { opacity: 1; transform: translateX(0); }' +
    '.toast.hide { opacity: 0; transform: translateX(100%); }' +
    '.toast-icon { margin-right: 8px; }' +
    '@media (max-width: 480px) {' +
    '  #toast-container { top: 8px; right: 8px; max-width: calc(100% - 16px); }' +
    '  .toast { font-size: 13px; padding: 12px 14px; }' +
    '}';
  document.head.appendChild(style);

  // Connect to Socket.io
  var socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', function () {
    socket.emit('join-role', role);
  });

  socket.on('notification', function (data) {
    showToast(data.message, data.icon || '\uD83D\uDD14');
  });

  function showToast(message, icon) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<span class="toast-icon">' + icon + '</span>' + message;
    container.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    var timer = setTimeout(function () { dismissToast(toast); }, 30000);
    toast.addEventListener('click', function () {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }

  function dismissToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }
});
