// routes/chat.js - Group chat page and message history API
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth } = require('../middleware/auth');
  const { styles, adminStyles, getBodyTag, getAppBgStyles, escapeHtml } = require('../views/htmlHelpers');
  const { getNav, dashboardHeader } = require('../views/components');

  const appBgStyles = () => getAppBgStyles(appConfig);
  const bodyTag = (req) => getBodyTag(req, appConfig);

  // Chat styles loaded from external CSS file
  const chatStyles = '<link rel="stylesheet" href="/css/chat.css">';

  // Middleware: requires login + chat_enabled flag
  function requireChatAccess(req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/login');
    if (appConfig.chatEnabled === false) return res.redirect('/dashboard');
    if (!req.session.user.chat_enabled) return res.redirect('/dashboard');
    next();
  }

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
