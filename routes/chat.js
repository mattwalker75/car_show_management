// routes/chat.js - Group chat page and message history API
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth } = require('../middleware/auth');
  const { getAvatarContent, dashboardHeader, getNav } = require('../views/components');
  const { getAppBackgroundStyles } = require('../views/layout');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => { const u = req.session && req.session.user; return `<body data-user-role="${u ? u.role : ''}" data-user-id="${u ? u.user_id : ''}" data-user-name="${u ? u.name : ''}" data-user-image="${u && u.image_url ? u.image_url : ''}">`; };

  // Middleware: requires login + chat_enabled flag
  function requireChatAccess(req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/login');
    if (appConfig.chatEnabled === false) return res.redirect('/dashboard');
    if (!req.session.user.chat_enabled) return res.redirect('/dashboard');
    next();
  }

  // HTML-escape helper to prevent XSS
  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
  }

  // Inline CSS for the chat UI
  const chatStyles = `
    <style>
      .chat-container {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 220px);
        min-height: 400px;
        position: relative;
        overflow-x: hidden;
      }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        -webkit-overflow-scrolling: touch;
      }
      .chat-msg {
        display: flex;
        gap: 10px;
        max-width: 85%;
      }
      .chat-msg.own {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .chat-msg-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        color: white;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
      }
      .chat-msg-content {
        background: #f8f9fa;
        border-radius: 12px;
        border: 1px solid #e1e1e1;
        padding: 8px 12px;
      }
      .chat-msg.own .chat-msg-content {
        background: #e8f4fd;
        border-color: #b8daff;
      }
      .chat-msg-name {
        font-weight: 600;
        font-size: 13px;
        color: #1a1a2e;
      }
      .chat-msg-time {
        font-size: 11px;
        color: #999;
      }
      .chat-msg-text {
        font-size: 14px;
        color: #333;
        word-wrap: break-word;
      }
      .chat-input-area {
        border-top: 2px solid #e1e1e1;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 0 0 12px 12px;
      }
      .chat-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .chat-input-row textarea {
        flex: 1;
        padding: 10px 14px;
        border: 2px solid #e1e1e1;
        border-radius: 10px;
        font-size: 15px;
        resize: none;
        max-height: 100px;
        font-family: inherit;
      }
      .chat-input-row textarea:focus {
        outline: none;
        border-color: #e94560;
      }
      .chat-send-btn {
        padding: 10px 20px;
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        min-height: 44px;
        transition: opacity 0.15s, background 0.15s;
      }
      .chat-send-btn.cooldown {
        opacity: 0.5;
        cursor: not-allowed;
        background: #888;
      }
      .chat-sidebar {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 260px;
        max-width: 80vw;
        background: #f8f9fa;
        border-left: 1px solid #e1e1e1;
        padding: 16px 12px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 500;
        box-shadow: none;
      }
      .chat-sidebar.open {
        transform: translateX(0);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      }
      .chat-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .chat-sidebar-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: #e1e1e1;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        color: #666;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .chat-sidebar-close:active {
        background: #c0c0c0;
      }
      .chat-sidebar-backdrop {
        display: none;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.2);
        z-index: 499;
      }
      .chat-sidebar-backdrop.visible {
        display: block;
      }
      .chat-sidebar-tab {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        z-index: 498;
        background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
        color: white;
        border: none;
        border-radius: 8px 0 0 8px;
        padding: 12px 6px;
        cursor: pointer;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
        transition: opacity 0.3s ease;
        min-height: 80px;
      }
      .chat-sidebar-tab:active {
        opacity: 0.8;
      }
      .chat-sidebar-tab .tab-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 22px;
        height: 22px;
        font-size: 11px;
        font-weight: 700;
        writing-mode: horizontal-tb;
      }
      .chat-sidebar-tab .tab-label {
        letter-spacing: 0.5px;
      }
      .chat-sidebar-tab.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .online-user {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 13px;
      }
      .online-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #27ae60;
        flex-shrink: 0;
      }
      .online-indicator.away {
        background: #f39c12;
      }
      .btn-load-more {
        background: none;
        border: 1px solid #e1e1e1;
        border-radius: 8px;
        padding: 8px 16px;
        color: #666;
        width: 100%;
        cursor: pointer;
        font-size: 13px;
      }
      .btn-load-more:hover {
        background: #f0f0f0;
      }
      .char-counter {
        text-align: right;
        font-size: 11px;
        color: #888;
      }
      .role-badge {
        display: inline-block;
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .role-badge.admin {
        background: #e8f4fd;
        color: #2980b9;
      }
      .role-badge.judge {
        background: #fef3e2;
        color: #e67e22;
      }
      .role-badge.registrar {
        background: #e8f8f5;
        color: #27ae60;
      }
      .role-badge.vendor {
        background: #f4e8ff;
        color: #8e44ad;
      }
      .role-badge.user {
        background: #f0f0f0;
        color: #666;
      }
      .chat-empty {
        text-align: center;
        color: #999;
        padding: 40px 20px;
        font-size: 14px;
      }
      .blocked-indicator {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .blocked-indicator svg {
        width: 14px;
        height: 14px;
      }
      .block-btn {
        width: 20px;
        height: 20px;
        border: none;
        background: none;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        opacity: 0.4;
        transition: opacity 0.2s;
      }
      .block-btn:hover {
        opacity: 1;
      }
      .block-btn.is-blocked {
        opacity: 1;
      }
      .block-btn svg {
        width: 16px;
        height: 16px;
      }
      .chat-input-area.disabled textarea,
      .chat-input-area.disabled button {
        pointer-events: none;
        opacity: 0.4;
      }
      .chat-blocked-notice {
        text-align: center;
        color: #e94560;
        font-size: 13px;
        font-weight: 600;
        padding: 8px;
      }
      .online-user.is-blocked .online-user-name {
        color: #999;
        text-decoration: line-through;
      }
    </style>`;

  // ============================================================
  // GET / — Serve the chat page
  // ============================================================
  router.get('/', requireChatAccess, async (req, res) => {
    const user = req.session.user;
    const role = user.role;
    const header = dashboardHeader(role, user, appConfig.appTitle || 'Car Show Manager');
    const nav = getNav(role, 'chat', (appConfig.chatEnabled !== false && user.chat_enabled));

    // Fetch current chat_blocked status from DB (session may be stale)
    let chatBlocked = false;
    try {
      const row = await db.getAsync('SELECT chat_blocked FROM users WHERE user_id = ?', [user.user_id]);
      chatBlocked = row && row.chat_blocked === 1;
    } catch (err) {
      console.error('Error fetching chat_blocked status:', err.message);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Group Chat - ${appConfig.appTitle || 'Car Show Manager'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        ${appBgStyles()}
        ${chatStyles}
      </head>
      ${bodyTag(req)}
        <div class="container dashboard-container">
          ${header}
          ${nav}

          <div class="chat-container">
            <div style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;">
              <div class="chat-messages" id="chatMessages">
                <button class="btn-load-more" id="loadMore" onclick="loadOlderMessages()" style="display:none;">Load older messages</button>
              </div>
              <div class="chat-input-area" id="chatInputArea">
                <div class="char-counter"><span id="charCount">0</span>/250</div>
                <div class="chat-input-row">
                  <textarea id="chatInput" maxlength="250" rows="1" placeholder="Type a message..."></textarea>
                  <button class="chat-send-btn" id="chatSend">Send</button>
                </div>
              </div>
            </div>
            <div class="chat-sidebar-backdrop" id="chatSidebarBackdrop"></div>
            <div class="chat-sidebar" id="chatSidebar">
              <div class="chat-sidebar-header">
                <strong>Online (<span id="onlineCount">0</span>)</strong>
                <button class="chat-sidebar-close" id="chatSidebarClose" aria-label="Close panel">&times;</button>
              </div>
              <div id="onlineUsersList"></div>
            </div>
            <button class="chat-sidebar-tab" id="chatSidebarTab" aria-label="Show online users">
              <span class="tab-count" id="onlineCountTab">0</span>
              <span class="tab-label">Online</span>
            </button>
          </div>

        </div>

        <script>
          window.CHAT_USER = {
            user_id: ${user.user_id},
            name: "${escapeHtml(user.name)}",
            role: "${escapeHtml(role)}",
            image_url: "${user.image_url ? escapeHtml(user.image_url) : ''}",
            chat_blocked: ${chatBlocked ? 'true' : 'false'}
          };
        </script>
        <script src="/js/chat.js"></script>
      </body>
      </html>
    `);
  });

  // ============================================================
  // GET /messages — JSON API for paginated chat history
  // ============================================================
  router.get('/messages', requireChatAccess, async (req, res) => {
    try {
      const before = req.query.before ? parseInt(req.query.before, 10) : null;
      const limit = 50;
      let messages;

      if (before) {
        messages = await db.allAsync(
          `SELECT cm.message_id, cm.user_id, cm.message, cm.created_at,
                  u.name, u.role, u.image_url
           FROM chat_messages cm
           JOIN users u ON cm.user_id = u.user_id
           WHERE cm.message_id < ?
           ORDER BY cm.message_id DESC
           LIMIT ?`,
          [before, limit]
        );
      } else {
        messages = await db.allAsync(
          `SELECT cm.message_id, cm.user_id, cm.message, cm.created_at,
                  u.name, u.role, u.image_url
           FROM chat_messages cm
           JOIN users u ON cm.user_id = u.user_id
           ORDER BY cm.message_id DESC
           LIMIT ?`,
          [limit]
        );
      }

      res.json({
        messages: messages.reverse(),
        hasMore: messages.length === limit
      });
    } catch (err) {
      console.error('Error fetching chat messages:', err.message);
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  return router;
};
