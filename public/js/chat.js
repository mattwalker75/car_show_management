// chat.js - Group chat client using Socket.io
// Reads window.CHAT_USER for current user info, connects to Socket.io,
// handles sending/receiving messages, online users, and message history.
document.addEventListener('DOMContentLoaded', function () {
  var user = window.CHAT_USER;
  if (!user) return;

  // DOM references
  var messagesEl = document.getElementById('chatMessages');
  var inputEl = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSend');
  var charCount = document.getElementById('charCount');
  var onlineList = document.getElementById('onlineUsersList');
  var onlineCountEl = document.getElementById('onlineCount');
  var loadMoreEl = document.getElementById('loadMore');
  var oldestMessageId = null;
  var hasMore = false;

  // Slide-over sidebar references
  var sidebarEl = document.getElementById('chatSidebar');
  var sidebarTab = document.getElementById('chatSidebarTab');
  var sidebarBackdrop = document.getElementById('chatSidebarBackdrop');
  var sidebarCloseBtn = document.getElementById('chatSidebarClose');
  var onlineCountTabEl = document.getElementById('onlineCountTab');

  // --- Sidebar slide-over toggle ---

  function openSidebar() {
    sidebarEl.classList.add('open');
    sidebarBackdrop.classList.add('visible');
    sidebarTab.classList.add('hidden');
  }

  function closeSidebar() {
    sidebarEl.classList.remove('open');
    sidebarBackdrop.classList.remove('visible');
    sidebarTab.classList.remove('hidden');
  }

  sidebarTab.addEventListener('click', function () {
    openSidebar();
  });

  sidebarCloseBtn.addEventListener('click', function () {
    closeSidebar();
  });

  sidebarBackdrop.addEventListener('click', function () {
    closeSidebar();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebarEl.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Swipe right to close on touch devices
  (function () {
    var startX = 0;
    var startY = 0;
    var tracking = false;

    sidebarEl.addEventListener('touchstart', function (e) {
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }, { passive: true });

    sidebarEl.addEventListener('touchmove', function (e) {
      if (!tracking) return;
      var touch = e.touches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (dx > 60 && Math.abs(dy) < Math.abs(dx)) {
        closeSidebar();
        tracking = false;
      }
    }, { passive: true });

    sidebarEl.addEventListener('touchend', function () {
      tracking = false;
    }, { passive: true });
  })();

  // Socket connection
  var socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', function () {
    socket.emit('join-chat', {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      image_url: user.image_url
    });
  });

  // --- Blocked state management ---
  var inputArea = document.getElementById('chatInputArea');

  function disableChatInput() {
    if (!inputArea) return;
    inputArea.classList.add('disabled');
    if (!inputArea.querySelector('.chat-blocked-notice')) {
      var notice = document.createElement('div');
      notice.className = 'chat-blocked-notice';
      notice.textContent = 'Chat disabled \u2014 please consult admin for re-enablement';
      inputArea.insertBefore(notice, inputArea.firstChild);
    }
    inputEl.disabled = true;
    sendBtn.disabled = true;
  }

  function enableChatInput() {
    if (!inputArea) return;
    inputArea.classList.remove('disabled');
    var notice = inputArea.querySelector('.chat-blocked-notice');
    if (notice) notice.remove();
    inputEl.disabled = false;
    sendBtn.disabled = false;
  }

  // Check initial blocked state from server-rendered data
  if (user.chat_blocked) {
    disableChatInput();
  }

  // Receive block/unblock notifications from server
  socket.on('chat-blocked', function () {
    user.chat_blocked = true;
    disableChatInput();
  });

  socket.on('chat-unblocked', function () {
    user.chat_blocked = false;
    enableChatInput();
  });

  // Load initial messages
  fetch('/chat/messages')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.messages && data.messages.length > 0) {
        renderMessages(data.messages, false);
        hasMore = data.hasMore;
        if (hasMore) loadMoreEl.style.display = 'block';
      } else {
        messagesEl.innerHTML += '<div class="chat-empty">No messages yet. Start the conversation!</div>';
      }
      scrollToBottom();
    })
    .catch(function () {
      messagesEl.innerHTML += '<div class="chat-empty">Failed to load messages. Try refreshing the page.</div>';
    });

  // Receive new message
  socket.on('chat-message', function (msg) {
    var empty = messagesEl.querySelector('.chat-empty');
    if (empty) empty.remove();
    appendMessage(msg);
    if (isNearBottom()) scrollToBottom();
  });

  // Online users updates
  socket.on('chat-users-update', function (users) {
    renderOnlineUsers(users);
  });

  // --- Send message with rate limiting ---
  // Client-side rate limit: 500ms between messages. Button shows cooldown state.
  // Server also enforces this limit; messages sent faster are silently dropped.
  var RATE_LIMIT_MS = 500;
  var sendCooldown = false;

  function sendMessage() {
    if (user.chat_blocked) return;
    if (sendCooldown) return;
    var text = inputEl.value.trim();
    if (!text || text.length > 250) return;

    socket.emit('chat-send', { message: text });
    inputEl.value = '';
    charCount.textContent = '0';
    charCount.style.color = '#888';
    autoResizeTextarea();

    // Start cooldown
    sendCooldown = true;
    sendBtn.classList.add('cooldown');
    setTimeout(function () {
      sendCooldown = false;
      sendBtn.classList.remove('cooldown');
    }, RATE_LIMIT_MS);
  }

  // --- Event listeners ---

  sendBtn.addEventListener('click', function () {
    sendMessage();
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener('input', function () {
    var len = inputEl.value.length;
    charCount.textContent = String(len);
    charCount.style.color = len > 200 ? '#e94560' : '#888';
    autoResizeTextarea();
  });

  // --- Textarea auto-resize ---

  function autoResizeTextarea() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  }

  // --- Load older messages ---

  window.loadOlderMessages = function () {
    if (!hasMore || !oldestMessageId) return;
    fetch('/chat/messages?before=' + oldestMessageId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.messages || data.messages.length === 0) {
          hasMore = false;
          loadMoreEl.style.display = 'none';
          return;
        }
        var scrollHeightBefore = messagesEl.scrollHeight;
        renderMessages(data.messages, true);
        hasMore = data.hasMore;
        if (!hasMore) loadMoreEl.style.display = 'none';
        messagesEl.scrollTop = messagesEl.scrollHeight - scrollHeightBefore;
      })
      .catch(function () {
        // Silently fail — user can retry by clicking Load More again
      });
  };

  // --- Render a batch of messages ---

  function renderMessages(messages, isPrepend) {
    var i, msg, el;
    for (i = 0; i < messages.length; i++) {
      msg = messages[i];
      el = createMessageEl(msg);
      if (oldestMessageId === null || msg.message_id < oldestMessageId) {
        oldestMessageId = msg.message_id;
      }
      if (isPrepend) {
        // Insert after the loadMore element
        if (loadMoreEl.nextSibling) {
          messagesEl.insertBefore(el, loadMoreEl.nextSibling);
        } else {
          messagesEl.appendChild(el);
        }
      } else {
        messagesEl.appendChild(el);
      }
    }
  }

  // --- Append a single new message ---

  function appendMessage(msg) {
    var el = createMessageEl(msg);
    messagesEl.appendChild(el);
  }

  // --- Create a message DOM element ---

  function createMessageEl(msg) {
    var div = document.createElement('div');
    div.className = 'chat-msg';
    if (msg.user_id === user.user_id) {
      div.className += ' own';
    }
    div.setAttribute('data-message-id', msg.message_id);

    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'chat-msg-avatar';
    if (msg.image_url) {
      var img = document.createElement('img');
      img.src = msg.image_url;
      img.alt = msg.name;
      avatarDiv.appendChild(img);
    } else {
      avatarDiv.textContent = getInitials(msg.name);
    }

    var contentDiv = document.createElement('div');
    contentDiv.className = 'chat-msg-content';

    var headerDiv = document.createElement('div');
    headerDiv.className = 'chat-msg-header';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'chat-msg-name';
    nameSpan.textContent = msg.name;

    var roleSpan = document.createElement('span');
    roleSpan.className = 'role-badge ' + msg.role;
    roleSpan.textContent = msg.role;

    var timeSpan = document.createElement('span');
    timeSpan.className = 'chat-msg-time';
    timeSpan.textContent = formatTime(msg.created_at);

    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(roleSpan);
    headerDiv.appendChild(timeSpan);

    var textDiv = document.createElement('div');
    textDiv.className = 'chat-msg-text';
    // CRITICAL: use textContent to prevent XSS
    textDiv.textContent = msg.message;

    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(textDiv);

    div.appendChild(avatarDiv);
    div.appendChild(contentDiv);

    return div;
  }

  // --- Format timestamp ---

  function formatTime(isoString) {
    var date = new Date(isoString);
    var now = new Date();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    var displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    var displayMinutes = minutes < 10 ? '0' + minutes : String(minutes);
    var timeStr = displayHours + ':' + displayMinutes + ' ' + ampm;

    var isToday = date.getFullYear() === now.getFullYear() &&
                  date.getMonth() === now.getMonth() &&
                  date.getDate() === now.getDate();

    if (isToday) {
      return timeStr;
    }

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + timeStr;
  }

  // --- Get initials from a name ---

  function getInitials(name) {
    if (!name) return '?';
    var parts = name.split(' ');
    var initials = '';
    for (var i = 0; i < parts.length && initials.length < 2; i++) {
      if (parts[i].length > 0) {
        initials += parts[i][0].toUpperCase();
      }
    }
    return initials || '?';
  }

  // --- Render online users sidebar ---

  function renderOnlineUsers(users) {
    onlineList.innerHTML = '';
    onlineCountEl.textContent = String(users.length);
    onlineCountTabEl.textContent = String(users.length);

    var sorted = users.slice().sort(function (a, b) {
      var nameA = (a.name || '').toLowerCase();
      var nameB = (b.name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    for (var i = 0; i < sorted.length; i++) {
      var u = sorted[i];
      var div = document.createElement('div');
      div.className = 'online-user' + (u.chat_blocked ? ' is-blocked' : '');

      var indicator = document.createElement('div');
      if (u.chat_blocked) {
        indicator.className = 'blocked-indicator';
        indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#e94560" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
      } else {
        indicator.className = 'online-indicator' + (u.status === 'away' ? ' away' : '');
      }

      var nameSpan = document.createElement('span');
      nameSpan.className = 'online-user-name';
      nameSpan.textContent = u.name;

      var roleSpan = document.createElement('span');
      roleSpan.className = 'role-badge ' + u.role;
      roleSpan.textContent = u.role;

      div.appendChild(indicator);
      div.appendChild(nameSpan);
      div.appendChild(roleSpan);

      // Admin sees block/unblock button on non-admin users
      if (user.role === 'admin' && u.role !== 'admin') {
        var blockBtn = document.createElement('button');
        blockBtn.className = 'block-btn' + (u.chat_blocked ? ' is-blocked' : '');
        blockBtn.title = u.chat_blocked ? 'Unblock user' : 'Block user';
        blockBtn.setAttribute('data-user-id', u.user_id);
        blockBtn.innerHTML = u.chat_blocked
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="#e94560" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
        blockBtn.addEventListener('click', (function (targetId, isBlocked) {
          return function () {
            socket.emit(isBlocked ? 'chat-unblock' : 'chat-block', { user_id: targetId });
          };
        })(u.user_id, u.chat_blocked));
        div.appendChild(blockBtn);
      }

      onlineList.appendChild(div);
    }
  }

  // --- Scroll helpers ---

  function isNearBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});
