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

  // --- Send message ---

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || text.length > 500) return;
    socket.emit('chat-send', { message: text });
    inputEl.value = '';
    charCount.textContent = '0';
    charCount.style.color = '#888';
    autoResizeTextarea();
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
    charCount.style.color = len > 450 ? '#e94560' : '#888';
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
      div.className = 'online-user';

      var indicator = document.createElement('div');
      indicator.className = 'online-indicator' + (u.status === 'away' ? ' away' : '');

      var nameSpan = document.createElement('span');
      nameSpan.className = 'online-user-name';
      nameSpan.textContent = u.name;

      var roleSpan = document.createElement('span');
      roleSpan.className = 'role-badge ' + u.role;
      roleSpan.textContent = u.role;

      div.appendChild(indicator);
      div.appendChild(nameSpan);
      div.appendChild(roleSpan);

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
