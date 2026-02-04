// routes/adminConfig/categories.js - Category and question management routes
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Judge categories management page
  router.get('/categories', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      db.all(`SELECT jc.*, v.vehicle_name,
                     (SELECT COUNT(*) FROM judge_questions jq WHERE jq.judge_catagory_id = jc.judge_catagory_id) as question_count
              FROM judge_catagories jc
              LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
              ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name`, (err, categories) => {
        if (err) categories = [];

        const rows = categories.map(c => `
          <tr style="border-bottom:none;">
            <td style="border-bottom:none;">${c.catagory_name}</td>
            <td style="border-bottom:none;">${c.vehicle_name || 'N/A'}</td>
            <td style="border-bottom:none;">${c.display_order}</td>
            <td style="border-bottom:none;">${c.question_count}</td>
            <td style="border-bottom:none;"><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
          </tr>
          <tr>
            <td colspan="5" style="border-top:none;padding-top:0;text-align:center;">
              <a href="/admin/edit-category/${c.judge_catagory_id}" class="action-btn edit">Edit</a>
              <a href="/admin/category-questions/${c.judge_catagory_id}" class="action-btn" style="background:#3498db;">Questions</a>
              <a href="#" onclick="confirmDeleteCategory(${c.judge_catagory_id}, '${c.catagory_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
            </td>
          </tr>
        `).join('');

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Judging Categories - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

              <h3 class="section-title">Judging Categories</h3>
              <p style="color:#666;margin-bottom:15px;">Define judging categories like Engine, Paint, Interior, etc.</p>

              <form method="POST" action="/admin/add-category" style="margin-bottom:20px;">
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <select name="vehicle_id" required style="min-width:150px;">
                    <option value="">Select Type...</option>
                    ${vehicleOptionsHtml}
                  </select>
                  <input type="text" name="catagory_name" required placeholder="Category name" style="flex:1;min-width:150px;">
                  <input type="text" name="display_order" value="0" placeholder="Order" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  <button type="submit" style="white-space:nowrap;">Add Category</button>
                </div>
              </form>

              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Category Name</th>
                      <th>Vehicle Type</th>
                      <th>Order</th>
                      <th>Questions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No categories defined yet.</td></tr>'}
                  </tbody>
                </table>
              </div>
              <div class="links" style="margin-top:20px;">
                <a href="/admin/dashboard">&larr; Back to Dashboard</a>
              </div>
            </div>

            <script>
              function confirmDeleteCategory(id, name) {
                if (confirm('Are you sure you want to delete the category "' + name + '"?\\n\\nThis will also delete ALL questions in this category.\\n\\nThis action cannot be undone.')) {
                  window.location.href = '/admin/delete-category/' + id;
                }
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });

  // Add category
  router.post('/add-category', requireAdmin, (req, res) => {
    const { vehicle_id, catagory_name, display_order } = req.body;
    db.run('INSERT INTO judge_catagories (vehicle_id, catagory_name, display_order) VALUES (?, ?, ?)',
      [vehicle_id, catagory_name, display_order || 0], (err) => {
      res.redirect('/admin/categories');
    });
  });

  // Delete category (also deletes all questions in this category)
  router.get('/delete-category/:id', requireAdmin, (req, res) => {
    const categoryId = req.params.id;

    // First delete all questions for this category
    db.run('DELETE FROM judge_questions WHERE judge_catagory_id = ?', [categoryId], (err) => {
      // Then delete the category itself
      db.run('DELETE FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err) => {
        res.redirect('/admin/categories');
      });
    });
  });

  // Edit category page
  router.get('/edit-category/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const categoryId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get('SELECT * FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${category.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Edit Category - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

              <h3 class="section-title">Edit Category</h3>

              <form method="POST" action="/admin/edit-category/${category.judge_catagory_id}">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Vehicle Type</label>
                    <select name="vehicle_id" required>
                      ${vehicleOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Category Name</label>
                    <input type="text" name="catagory_name" required value="${category.catagory_name}">
                  </div>
                  <div class="form-group">
                    <label>Display Order</label>
                    <input type="text" name="display_order" value="${category.display_order}" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group">
                    <label>Status</label>
                    <select name="is_active">
                      <option value="1" ${category.is_active ? 'selected' : ''}>Active</option>
                      <option value="0" ${!category.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                  </div>
                  <button type="submit">Update Category</button>
                </div>
              </form>

              <div class="links" style="margin-top:20px;">
                <a href="/admin/categories">Back to Judge Config</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Update category
  router.post('/edit-category/:id', requireAdmin, (req, res) => {
    const categoryId = req.params.id;
    const { vehicle_id, catagory_name, display_order, is_active } = req.body;
    db.run('UPDATE judge_catagories SET vehicle_id = ?, catagory_name = ?, display_order = ?, is_active = ? WHERE judge_catagory_id = ?',
      [vehicle_id, catagory_name, display_order || 0, is_active, categoryId], (err) => {
      res.redirect('/admin/categories');
    });
  });

  // Category questions page
  router.get('/category-questions/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const categoryId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get(`SELECT jc.*, v.vehicle_name
            FROM judge_catagories jc
            LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
            WHERE jc.judge_catagory_id = ?`, [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.all(`SELECT * FROM judge_questions WHERE judge_catagory_id = ? ORDER BY display_order, question`,
        [categoryId], (err, questions) => {
        if (err) questions = [];

        const rows = questions.map(q => `
          <tr>
            <td>${q.question}</td>
            <td>${q.min_score} - ${q.max_score}</td>
            <td>${q.display_order}</td>
            <td><span class="status-badge ${q.is_active ? 'active' : 'inactive'}">${q.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <a href="/admin/edit-question/${q.judge_question_id}" class="action-btn edit">Edit</a>
              <a href="#" onclick="confirmDeleteQuestion(${q.judge_question_id}, '${q.question.replace(/'/g, "\\'")}', ${categoryId}); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
            </td>
          </tr>
        `).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Questions: ${category.catagory_name} - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

              <h3 class="section-title">Questions: ${category.catagory_name}</h3>
              <p style="color:#666;margin-bottom:15px;">Vehicle Type: ${category.vehicle_name}</p>

              <form method="POST" action="/admin/add-question/${category.judge_catagory_id}" style="margin-bottom:20px;">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Question</label>
                    <input type="text" name="question" required placeholder="e.g., Condition of paint finish">
                  </div>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Min Score</label>
                      <input type="text" name="min_score" value="${appConfig.defaultMinScore ?? 0}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Max Score</label>
                      <input type="text" name="max_score" value="${appConfig.defaultMaxScore ?? 10}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                    <div class="form-group" style="flex:1;min-width:100px;">
                      <label>Order</label>
                      <input type="text" name="display_order" value="0" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                    </div>
                  </div>
                  <button type="submit">Add Question</button>
                </div>
              </form>

              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Score Range</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No questions defined yet.</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div class="links" style="margin-top:20px;">
                <a href="/admin/categories">Back to Judge Config</a>
              </div>
            </div>

            <script>
              function confirmDeleteQuestion(id, name, categoryId) {
                if (confirm('Are you sure you want to delete this question?\\n\\n"' + name + '"\\n\\nThis action cannot be undone.')) {
                  window.location.href = '/admin/delete-question/' + id + '?categoryId=' + categoryId;
                }
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });

  // Add question
  router.post('/add-question/:categoryId', requireAdmin, (req, res) => {
    const categoryId = req.params.categoryId;
    const { question, min_score, max_score, display_order } = req.body;

    if (!/^\d+$/.test((min_score || '').trim()) || !/^\d+$/.test((max_score || '').trim())) {
      return res.send(errorPage('Min Score and Max Score must be whole numbers.', '/admin/category-questions/' + categoryId, 'Try Again'));
    }

    // Get the vehicle_id from the category
    db.get('SELECT vehicle_id FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
      if (err || !category) {
        res.redirect('/admin/categories');
        return;
      }

      db.run('INSERT INTO judge_questions (vehicle_id, judge_catagory_id, question, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [category.vehicle_id, categoryId, question, parseInt(min_score) || 0, parseInt(max_score) || 10, parseInt(display_order) || 0], (err) => {
        res.redirect(`/admin/category-questions/${categoryId}`);
      });
    });
  });

  // Delete question
  router.get('/delete-question/:id', requireAdmin, (req, res) => {
    const questionId = req.params.id;
    const categoryId = req.query.categoryId;

    db.run('DELETE FROM judge_questions WHERE judge_question_id = ?', [questionId], (err) => {
      res.redirect(`/admin/category-questions/${categoryId}`);
    });
  });

  // Edit question page
  router.get('/edit-question/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const questionId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get(`SELECT jq.*, jc.catagory_name
            FROM judge_questions jq
            LEFT JOIN judge_catagories jc ON jq.judge_catagory_id = jc.judge_catagory_id
            WHERE jq.judge_question_id = ?`, [questionId], (err, question) => {
      if (err || !question) {
        res.redirect('/admin/categories');
        return;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Question - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

            <h3 class="section-title">Edit Question</h3>
            <p style="color:#666;margin-bottom:15px;">Category: ${question.catagory_name}</p>

            <form method="POST" action="/admin/edit-question/${question.judge_question_id}">
              <input type="hidden" name="judge_catagory_id" value="${question.judge_catagory_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Question</label>
                  <input type="text" name="question" required value="${question.question}">
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Min Score</label>
                    <input type="text" name="min_score" value="${question.min_score}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Max Score</label>
                    <input type="text" name="max_score" value="${question.max_score}" required style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Order</label>
                    <input type="text" name="display_order" value="${question.display_order}" style="width:80px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${question.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!question.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Question</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/category-questions/${question.judge_catagory_id}">Back to Questions</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });

  // Update question
  router.post('/edit-question/:id', requireAdmin, (req, res) => {
    const questionId = req.params.id;
    const { judge_catagory_id, question, min_score, max_score, display_order, is_active } = req.body;

    if (!/^\d+$/.test((min_score || '').trim()) || !/^\d+$/.test((max_score || '').trim())) {
      return res.send(errorPage('Min Score and Max Score must be whole numbers.', '/admin/edit-question/' + questionId, 'Try Again'));
    }

    db.run('UPDATE judge_questions SET question = ?, min_score = ?, max_score = ?, display_order = ?, is_active = ? WHERE judge_question_id = ?',
      [question, parseInt(min_score) || 0, parseInt(max_score) || 10, parseInt(display_order) || 0, is_active, questionId], (err) => {
      res.redirect(`/admin/category-questions/${judge_catagory_id}`);
    });
  });

  return router;
};
