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
      }
      @media (min-width: 768px) {
        .chat-container {
          flex-direction: row;
        }
        .chat-sidebar {
          width: 220px;
          margin-top: 0 !important;
          margin-left: 12px;
          max-height: none !important;
        }
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
      }
      .chat-sidebar {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 12px;
        margin-top: 12px;
        border: 1px solid #e1e1e1;
        max-height: 200px;
        overflow-y: auto;
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
    </style>`;

  // ============================================================
  // GET / — Serve the chat page
  // ============================================================
  router.get('/', requireChatAccess, (req, res) => {
    const user = req.session.user;
    const role = user.role;
    const header = dashboardHeader(role, user, appConfig.appTitle || 'Car Show Manager');
    const nav = getNav(role, 'chat', (appConfig.chatEnabled !== false && user.chat_enabled));

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
            <div style="flex:1;display:flex;flex-direction:column;">
              <div class="chat-messages" id="chatMessages">
                <button class="btn-load-more" id="loadMore" onclick="loadOlderMessages()" style="display:none;">Load older messages</button>
              </div>
              <div class="chat-input-area">
                <div class="char-counter"><span id="charCount">0</span>/500</div>
                <div class="chat-input-row">
                  <textarea id="chatInput" maxlength="500" rows="1" placeholder="Type a message..."></textarea>
                  <button class="chat-send-btn" id="chatSend">Send</button>
                </div>
              </div>
            </div>
            <div class="chat-sidebar" id="chatSidebar">
              <strong>Online (<span id="onlineCount">0</span>)</strong>
              <div id="onlineUsersList"></div>
            </div>
          </div>

        </div>

        <script>
          window.CHAT_USER = {
            user_id: ${user.user_id},
            name: "${escapeHtml(user.name)}",
            role: "${escapeHtml(role)}",
            image_url: "${user.image_url ? escapeHtml(user.image_url) : ''}"
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
