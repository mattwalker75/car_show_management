// routes/adminConfig/specialtyVotes.js - Specialty vote configuration routes
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Specialty votes management page
  router.get('/specialty-votes', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    // Get vehicle types and classes for the form
    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];
      db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
        if (err) classes = [];

    const vehicleOptionsHtml = vehicleTypes.map(v =>
      `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
    ).join('');
    const classesJson = JSON.stringify(classes);

    // Get specialty votes with vote counts
    db.all(`
      SELECT sv.*,
             (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count,
             v.vehicle_name, cl.class_name
      FROM specialty_votes sv
      LEFT JOIN vehicles v ON sv.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON sv.class_id = cl.class_id
      ORDER BY sv.vote_name
    `, (err, specialtyVotes) => {
      if (err) specialtyVotes = [];

      const rows = specialtyVotes.map(sv => {
        const filterLabel = sv.vehicle_name
          ? (sv.class_name ? `${sv.vehicle_name} / ${sv.class_name}` : sv.vehicle_name)
          : 'All Vehicles';
        return `
        <tr style="border-bottom:none;">
          <td style="border-bottom:none;">${sv.vote_name}</td>
          <td style="border-bottom:none;">${sv.description || '-'}</td>
          <td style="border-bottom:none;">${sv.allow_all_users ? 'All Users' : 'Specific Users'}</td>
          <td style="border-bottom:none;">${filterLabel}</td>
          <td style="border-bottom:none;"><span style="background:var(--success-color);color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">${sv.vote_count} votes</span></td>
          <td style="border-bottom:none;"><span class="status-badge ${sv.is_active ? 'active' : 'inactive'}">${sv.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
        <tr>
          <td colspan="6" style="border-top:none;padding-top:0;text-align:center;">
            <a href="/admin/edit-specialty-vote/${sv.specialty_vote_id}" class="action-btn edit">Edit</a>
            <a href="/admin/specialty-vote-voters/${sv.specialty_vote_id}" class="action-btn" style="background:var(--btn-edit-bg);">Voters</a>
            <a href="#" onclick="confirmDeleteSpecialtyVote(${sv.specialty_vote_id}, '${sv.vote_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:var(--btn-delete-bg);">Delete</a>
          </td>
        </tr>
      `}).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Special Vote Config - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

            <h3 class="section-title">Special Vote Config</h3>
            <p style="color:var(--text-secondary);margin-bottom:15px;">Configure special voting categories like People's Choice, Best in Show, etc.</p>

            <form method="POST" action="/admin/add-specialty-vote" style="margin-bottom:20px;">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vote Name</label>
                  <input type="text" name="vote_name" required placeholder="e.g., People's Choice">
                </div>
                <div class="form-group">
                  <label>Description (Optional)</label>
                  <input type="text" name="description" placeholder="Brief description of this vote">
                </div>
                <div class="form-group">
                  <label>Who Can Vote?</label>
                  <select name="allow_all_users">
                    <option value="0">Specific Users Only</option>
                    <option value="1">All Users</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Vehicle Type (Optional)</label>
                  <select name="vehicle_id" id="svVehicleType" onchange="updateSvClasses()">
                    <option value="">All Vehicle Types</option>
                    ${vehicleOptionsHtml}
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Class (Optional)</label>
                  <select name="class_id" id="svClassSelect">
                    <option value="">All Classes</option>
                  </select>
                </div>
                <button type="submit">Add Specialty Vote</button>
              </div>
            </form>

            <div class="table-wrapper config-table">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Voters</th>
                    <th>Applies To</th>
                    <th>Votes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">No specialty votes defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="links" style="margin-top:20px;">
              <a href="/admin/dashboard">&larr; Back to Dashboard</a>
            </div>
          </div>

          <script>
            const allSvClasses = ${classesJson};

            function updateSvClasses() {
              const vehicleId = document.getElementById('svVehicleType').value;
              const classSelect = document.getElementById('svClassSelect');
              classSelect.innerHTML = '<option value="">All Classes</option>';
              if (vehicleId) {
                const filtered = allSvClasses.filter(c => c.vehicle_id == vehicleId);
                filtered.forEach(c => {
                  classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
                });
              }
            }

            function confirmDeleteSpecialtyVote(id, name) {
              if (confirm('Are you sure you want to delete the specialty vote "' + name + '"?\\n\\nThis will also remove all voter assignments.\\n\\nThis action cannot be undone.')) {
                window.location.href = '/admin/delete-specialty-vote/' + id;
              }
            }
          </script>
        </body>
        </html>
      `);
    });
      }); // end classes query
    }); // end vehicleTypes query
  });

  // Add specialty vote
  router.post('/add-specialty-vote', requireAdmin, (req, res) => {
    const { vote_name, description, allow_all_users, vehicle_id, class_id } = req.body;
    db.run('INSERT INTO specialty_votes (vote_name, description, allow_all_users, vehicle_id, class_id) VALUES (?, ?, ?, ?, ?)',
      [vote_name, description || null, allow_all_users, vehicle_id || null, class_id || null], (err) => {
      res.redirect('/admin/specialty-votes');
    });
  });

  // Edit specialty vote page
  router.get('/edit-specialty-vote/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
        if (err) vehicleTypes = [];
        db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
          if (err) classes = [];

          const editVehicleOptions = vehicleTypes.map(v =>
            `<option value="${v.vehicle_id}" ${vote.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
          ).join('');

          const editClassOptions = vote.vehicle_id
            ? classes.filter(c => c.vehicle_id == vote.vehicle_id).map(c =>
                `<option value="${c.class_id}" ${vote.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
              ).join('')
            : '';

          const editClassesJson = JSON.stringify(classes);

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Specialty Vote - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}
            ${getAdminNav('config', chatEnabled)}

            <h3 class="section-title">Edit Specialty Vote</h3>

            <form method="POST" action="/admin/edit-specialty-vote/${vote.specialty_vote_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vote Name</label>
                  <input type="text" name="vote_name" required value="${vote.vote_name}">
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <input type="text" name="description" value="${vote.description || ''}">
                </div>
                <div class="form-group">
                  <label>Who Can Vote?</label>
                  <select name="allow_all_users">
                    <option value="0" ${!vote.allow_all_users ? 'selected' : ''}>Specific Users Only</option>
                    <option value="1" ${vote.allow_all_users ? 'selected' : ''}>All Users</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Vehicle Type (Optional)</label>
                  <select name="vehicle_id" id="editSvVehicleType" onchange="updateEditSvClasses()">
                    <option value="">All Vehicle Types</option>
                    ${editVehicleOptions}
                  </select>
                </div>
                <div class="form-group">
                  <label>Limit to Class (Optional)</label>
                  <select name="class_id" id="editSvClassSelect">
                    <option value="">All Classes</option>
                    ${editClassOptions}
                  </select>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${vote.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!vote.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Specialty Vote</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/specialty-votes">Back to Special Vote Config</a>
            </div>
          </div>

          <script>
            const editAllClasses = ${editClassesJson};
            function updateEditSvClasses() {
              const vehicleId = document.getElementById('editSvVehicleType').value;
              const classSelect = document.getElementById('editSvClassSelect');
              classSelect.innerHTML = '<option value="">All Classes</option>';
              if (vehicleId) {
                const filtered = editAllClasses.filter(c => c.vehicle_id == vehicleId);
                filtered.forEach(c => {
                  classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
                });
              }
            }
          </script>
        </body>
        </html>
      `);
        }); // end classes
      }); // end vehicleTypes
    });
  });

  // Update specialty vote
  router.post('/edit-specialty-vote/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;
    const { vote_name, description, allow_all_users, is_active, vehicle_id, class_id } = req.body;
    db.run('UPDATE specialty_votes SET vote_name = ?, description = ?, allow_all_users = ?, is_active = ?, vehicle_id = ?, class_id = ? WHERE specialty_vote_id = ?',
      [vote_name, description || null, allow_all_users, is_active, vehicle_id || null, class_id || null, voteId], (err) => {
      res.redirect('/admin/specialty-votes');
    });
  });

  // Delete specialty vote
  router.get('/delete-specialty-vote/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;

    // First delete all vote results
    db.run('DELETE FROM specialty_vote_results WHERE specialty_vote_id = ?', [voteId], (err) => {
      // Then delete all voter assignments
      db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
        // Then delete the specialty vote
        db.run('DELETE FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err) => {
          res.redirect('/admin/specialty-votes');
        });
      });
    });
  });

  // View/edit specialty vote results
  router.get('/specialty-vote-results/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      // Get vote tallies grouped by car, ordered by vote count
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id, c.image_url,
               u.name as owner_name,
               cl.class_name, v.vehicle_name,
               COUNT(svr.id) as vote_count
        FROM specialty_vote_results svr
        JOIN cars c ON svr.car_id = c.car_id
        LEFT JOIN users u ON c.user_id = u.user_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        WHERE svr.specialty_vote_id = ?
        GROUP BY c.car_id
        ORDER BY vote_count DESC, c.voter_id
      `, [voteId], (err, results) => {
        if (err) results = [];

        // Get total vote count
        const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

        // Determine winner(s) - vehicles with highest vote count
        const maxVotes = results.length > 0 ? results[0].vote_count : 0;
        const winners = results.filter(r => r.vote_count === maxVotes && maxVotes > 0);

        const resultRows = results.map((r, index) => {
          const isWinner = r.vote_count === maxVotes && maxVotes > 0;
          const percentage = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0;
          return `
            <tr style="${isWinner ? 'background:var(--status-active-bg);' : ''}">
              <td style="font-weight:700;font-size:18px;">${index + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  ${r.image_url ? `<img src="${r.image_url}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;">` : ''}
                  <div>
                    <div style="font-weight:600;">
                      ${r.voter_id ? `<span style="background:var(--btn-dark-bg);color:white;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">#${r.voter_id}</span>` : ''}
                      ${r.year || ''} ${r.make} ${r.model}
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);">${r.owner_name || 'Unknown'}</div>
                  </div>
                </div>
              </td>
              <td>${r.vehicle_name || '-'}</td>
              <td>${r.class_name || '-'}</td>
              <td style="font-weight:700;font-size:16px;">${r.vote_count}</td>
              <td>
                <div style="background:var(--card-border);border-radius:10px;height:20px;overflow:hidden;">
                  <div style="background:${isWinner ? '#27ae60' : '#3498db'};height:100%;width:${percentage}%;"></div>
                </div>
                <span style="font-size:12px;color:var(--text-secondary);">${percentage}%</span>
              </td>
              <td>${isWinner ? '<span style="background:var(--success-color);color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">WINNER</span>' : ''}</td>
            </tr>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Results: ${vote.vote_name} - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
            <style>
              .results-header {
                background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
              }
              .results-header h2 {
                color: white;
                margin-bottom: 5px;
              }
              .stats-row {
                display: flex;
                gap: 15px;
                margin-bottom: 20px;
                flex-wrap: wrap;
              }
              .stat-card {
                flex: 1;
                min-width: 120px;
                background: var(--card-bg);
                padding: 15px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid var(--card-border);
              }
              .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                color: var(--text-primary);
              }
              .stat-card .label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 5px;
              }
              .winner-card {
                background: linear-gradient(135deg, #f39c12 0%, #f1c40f 100%);
                color: var(--text-primary);
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
              }
              .winner-card h3 {
                margin-bottom: 10px;
              }
              .winner-card .trophy {
                font-size: 48px;
                margin-bottom: 10px;
              }
            </style>
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}
              ${getAdminNav('config', chatEnabled)}

              <div class="results-header">
                <h2>Results: ${vote.vote_name}</h2>
                ${vote.description ? `<p>${vote.description}</p>` : ''}
              </div>

              <div class="stats-row">
                <div class="stat-card">
                  <div class="number">${totalVotes}</div>
                  <div class="label">Total Votes</div>
                </div>
                <div class="stat-card">
                  <div class="number">${results.length}</div>
                  <div class="label">Vehicles Voted For</div>
                </div>
              </div>

              ${winners.length > 0 ? `
                <div class="winner-card">
                  <div class="trophy">🏆</div>
                  <h3>${winners.length > 1 ? 'TIE - Winners' : 'Winner'}</h3>
                  ${winners.map(w => `
                    <div style="font-size:18px;font-weight:600;">
                      ${w.voter_id ? `#${w.voter_id} - ` : ''}${w.year || ''} ${w.make} ${w.model}
                    </div>
                    <div style="font-size:14px;">Owner: ${w.owner_name || 'Unknown'} | ${w.vote_count} votes</div>
                  `).join('<hr style="margin:10px 0;border:none;border-top:1px solid rgba(0,0,0,0.1);">')}
                </div>
              ` : '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No votes have been cast yet.</p>'}

              ${results.length > 0 ? `
                <h3 class="section-title">Full Results</h3>
                <div class="table-wrapper config-table">
                  <table class="user-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Class</th>
                        <th>Votes</th>
                        <th>%</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${resultRows}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              <div class="links" style="margin-top:20px;">
                <a href="/admin/specialty-votes">Back to Special Vote Config</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // Manage voters for a specialty vote
  router.get('/specialty-vote-voters/:id', requireAdmin, (req, res) => {
    const user = req.session.user;
    const voteId = req.params.id;
    const saved = req.query.saved;
    const error = req.query.error;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/specialty-votes');
        return;
      }

      // Get all users
      db.all('SELECT user_id, username, name, role FROM users WHERE is_active = 1 ORDER BY name', (err, allUsers) => {
        if (err) allUsers = [];

        // Get currently assigned voters
        db.all('SELECT user_id FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err, assignedVoters) => {
          const assignedIds = new Set((assignedVoters || []).map(v => v.user_id));

          const userCheckboxes = allUsers.map(u => `
            <label class="voter-item" data-search="${u.name.toLowerCase()} ${u.username.toLowerCase()} ${u.user_id} ${u.role.toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--card-bg);border-radius:8px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" name="user_ids" value="${u.user_id}" ${assignedIds.has(u.user_id) ? 'checked' : ''} style="width:18px;height:18px;">
              <span><strong>${u.name}</strong> (${u.username}) - ${u.role}</span>
            </label>
          `).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Voters: ${vote.vote_name} - Admin</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
              ${getAppBgStyles(appConfig)}
            </head>
            ${getBodyTag(req)}
              <div class="container dashboard-container">
                ${adminHeader(user)}
                ${getAdminNav('config', chatEnabled)}

                <h3 class="section-title">Voters: ${vote.vote_name}</h3>
                ${saved ? '<div class="success-message" style="margin-bottom:15px;">Voter assignments saved successfully!</div>' : ''}
                ${error ? '<div style="background:var(--status-inactive-bg);color:var(--status-inactive-text);padding:12px;border-radius:8px;margin-bottom:15px;font-weight:600;">Failed to save voter assignments. Please try again.</div>' : ''}
                ${vote.allow_all_users
                  ? `<div class="profile-card">
                      <div style="background:var(--status-active-bg);color:#155724;padding:16px;border-radius:8px;text-align:center;">
                        <strong>All Users</strong><br>
                        <span style="font-size:14px;">This vote is configured to allow all users to participate. No individual voter assignments are needed.</span>
                      </div>
                    </div>`
                  : `<form method="POST" action="/admin/update-specialty-vote-voters/${vote.specialty_vote_id}" id="voterForm">
                  <div class="profile-card">
                    <p style="color:var(--text-secondary);margin-bottom:15px;">Select which users can participate in this vote.</p>
                    <div style="display:flex;gap:10px;margin-bottom:15px;">
                      <button type="button" onclick="selectAll()" style="flex:1;">Select All</button>
                      <button type="button" onclick="selectNone()" style="flex:1;background:var(--btn-secondary-bg);">Select None</button>
                    </div>

                    <div class="form-group" style="margin-bottom:15px;">
                      <input type="text" id="voterSearch" placeholder="Search by name, email, or user ID..." oninput="filterVoters()" style="width:100%;padding:10px 14px;border:2px solid var(--card-border);border-radius:8px;font-size:14px;">
                    </div>

                    <div id="voterList" style="max-height:400px;overflow-y:auto;">
                      ${userCheckboxes || '<p style="color:var(--text-secondary);">No users found.</p>'}
                    </div>

                    <button type="submit" style="margin-top:15px;">Save Voter Assignments</button>
                    <div id="saveMessage" style="display:none;margin-top:10px;padding:10px;border-radius:8px;text-align:center;font-weight:600;"></div>
                  </div>
                </form>`
                }

                <div class="links" style="margin-top:20px;">
                  <a href="/admin/specialty-votes">Back to Special Vote Config</a>
                </div>
              </div>

              <script>
                function selectAll() {
                  document.querySelectorAll('.voter-item').forEach(el => {
                    if (el.style.display !== 'none') el.querySelector('input').checked = true;
                  });
                }
                function selectNone() {
                  document.querySelectorAll('.voter-item').forEach(el => {
                    if (el.style.display !== 'none') el.querySelector('input').checked = false;
                  });
                }
                function filterVoters() {
                  const query = document.getElementById('voterSearch').value.toLowerCase().trim();
                  document.querySelectorAll('.voter-item').forEach(el => {
                    const text = el.getAttribute('data-search');
                    el.style.display = !query || text.includes(query) ? 'flex' : 'none';
                  });
                }
              </script>
            </body>
            </html>
          `);
        });
      });
    });
  });

  // Update voter assignments for a specialty vote
  router.post('/update-specialty-vote-voters/:id', requireAdmin, (req, res) => {
    const voteId = req.params.id;
    let userIds = req.body.user_ids || [];

    // Ensure userIds is an array
    if (!Array.isArray(userIds)) {
      userIds = userIds ? [userIds] : [];
    }

    // First delete all existing assignments
    db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
      if (err) {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
        return;
      }

      if (userIds.length === 0) {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
        return;
      }

      // Insert new assignments
      const placeholders = userIds.map(() => '(?, ?)').join(', ');
      const values = [];
      userIds.forEach(userId => {
        values.push(voteId, userId);
      });

      db.run(`INSERT INTO specialty_vote_voters (specialty_vote_id, user_id) VALUES ${placeholders}`, values, (err) => {
        if (err) {
          res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
        } else {
          res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
        }
      });
    });
  });

  return router;
};
