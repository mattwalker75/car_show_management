// routes/adminVoting/voteStatus.js - Routes for specialty voting status
const express = require('express');

module.exports = function (db, appConfig, upload, saveConfig) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { styles, adminStyles, getBodyTag, getAppBgStyles, getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav } = require('./shared');

  // ─── Specialty Vote Status Page ──────────────────────────────────────────────

  router.get('/vote-status', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    // Get all specialty votes with their results
    db.all(`
      SELECT sv.*,
             (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as total_votes
      FROM specialty_votes sv
      WHERE sv.is_active = 1
      ORDER BY sv.vote_name
    `, (err, specialtyVotes) => {
      if (err) specialtyVotes = [];

      // Get vote counts per car for each specialty vote
      db.all(`
        SELECT svr.specialty_vote_id, svr.car_id,
               c.year, c.make, c.model, c.voter_id,
               COUNT(*) as vote_count
        FROM specialty_vote_results svr
        JOIN cars c ON svr.car_id = c.car_id
        GROUP BY svr.specialty_vote_id, svr.car_id
        ORDER BY svr.specialty_vote_id, vote_count DESC
      `, (err, voteResults) => {
        if (err) voteResults = [];

        // Build results by specialty vote
        const resultsByVote = {};
        voteResults.forEach(vr => {
          if (!resultsByVote[vr.specialty_vote_id]) {
            resultsByVote[vr.specialty_vote_id] = [];
          }
          resultsByVote[vr.specialty_vote_id].push(vr);
        });

        const voteRows = specialtyVotes.map(sv => {
          const results = resultsByVote[sv.specialty_vote_id] || [];
          const topCar = results[0];
          const leaderInfo = topCar
            ? `${topCar.year || ''} ${topCar.make} ${topCar.model} (${topCar.vote_count} votes)`
            : 'No votes yet';

          return `
            <tr>
              <td><strong>${sv.vote_name}</strong></td>
              <td>${sv.description || '-'}</td>
              <td><span style="background:var(--success-color);color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${sv.total_votes}</span></td>
              <td>${leaderInfo}</td>
              <td>
                <a href="/admin/edit-vote-results/${sv.specialty_vote_id}" class="action-btn edit">View/Edit</a>
              </td>
            </tr>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vote Status - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}

              ${getAdminNav('voting', chatEnabled)}

              <h3 class="section-title">Specialty Vote Status</h3>

              <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; ${appConfig.specialtyVotingStatus === 'Lock' ? 'background:var(--btn-delete-bg);color:white;' : appConfig.specialtyVotingStatus === 'Open' ? 'background:var(--success-color);color:white;' : 'background:var(--btn-cancel-bg);color:white;'}">
                  ${appConfig.specialtyVotingStatus === 'Lock' ? '🔒 Voting LOCKED' : appConfig.specialtyVotingStatus === 'Open' ? '🔓 Voting OPEN' : '🚫 Voting CLOSED'}
                </span>
                <a href="/admin/preview-vote-results" class="action-btn" style="background:var(--btn-edit-bg);">Preview Results</a>
                ${appConfig.specialtyVotingStatus === 'Close' ? `
                  <a href="/admin/open-specialty-voting" class="action-btn" style="background:var(--success-color);" onclick="return confirm('Open voting? Users will be able to vote.')">Open Voting</a>
                ` : appConfig.specialtyVotingStatus === 'Open' ? `
                  <a href="/admin/close-specialty-voting" class="action-btn" style="background:var(--btn-cancel-bg);" onclick="return confirm('Close voting? Users will no longer be able to vote.')">Close Voting</a>
                  <a href="/admin/lock-specialty-voting" class="action-btn" style="background:var(--btn-delete-bg);" onclick="return confirm('Lock voting and publish results? Users will no longer be able to vote.')">Lock & Publish Results</a>
                ` : `
                  <a href="/admin/open-specialty-voting" class="action-btn" style="background:var(--success-color);" onclick="return confirm('Open voting? Users will be able to vote again.')">Open Voting</a>
                `}
              </div>

              <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: 600px;">
                  <thead>
                    <tr>
                      <th>Vote Name</th>
                      <th>Description</th>
                      <th>Total Votes</th>
                      <th>Current Leader</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${voteRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No specialty votes configured</td></tr>'}
                  </tbody>
                </table>
              </div>
              <div class="links" style="margin-top:20px;">
                <a href="/admin/dashboard">&larr; Back to Dashboard</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ─── Edit/View Vote Results ──────────────────────────────────────────────────

  router.get('/edit-vote-results/:voteId', requireAdmin, (req, res) => {
    const voteId = req.params.voteId;
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    db.get(`SELECT * FROM specialty_votes WHERE specialty_vote_id = ?`, [voteId], (err, vote) => {
      if (err || !vote) {
        res.redirect('/admin/vote-status');
        return;
      }

      // Get all votes with voter info
      db.all(`
        SELECT svr.*, u.name as voter_name, c.year, c.make, c.model, c.voter_id as car_voter_id
        FROM specialty_vote_results svr
        JOIN users u ON svr.user_id = u.user_id
        JOIN cars c ON svr.car_id = c.car_id
        WHERE svr.specialty_vote_id = ?
        ORDER BY svr.voted_at DESC
      `, [voteId], (err, results) => {
        if (err) results = [];

        const resultRows = results.map(r => `
          <tr>
            <td>${r.voter_name}</td>
            <td>${r.year || ''} ${r.make} ${r.model} (ID: ${r.car_voter_id || 'N/A'})</td>
            <td>${new Date(r.voted_at).toLocaleString()}</td>
            <td>
              <a href="/admin/delete-vote-result/${r.id}?voteId=${voteId}" class="action-btn" style="background:var(--btn-delete-bg);" onclick="return confirm('Delete this vote?')">Delete</a>
            </td>
          </tr>
        `).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vote Results - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}

              ${getAdminNav('voting', chatEnabled)}

              <h3 class="section-title">${vote.vote_name} - All Votes</h3>
              <p style="color:var(--text-secondary);margin-bottom:20px;">Total votes: ${results.length}</p>

              <div style="overflow-x: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Voter</th>
                      <th>Voted For</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${resultRows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No votes cast</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div style="margin-top:20px;">
                <a href="/admin/vote-status" class="action-btn" style="background:var(--text-secondary);">Back to Vote Status</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ─── Delete a Vote Result ────────────────────────────────────────────────────

  router.get('/delete-vote-result/:id', requireAdmin, (req, res) => {
    const resultId = req.params.id;
    const voteId = req.query.voteId;

    db.run(`DELETE FROM specialty_vote_results WHERE id = ?`, [resultId], (err) => {
      res.redirect(`/admin/edit-vote-results/${voteId}`);
    });
  });

  // ─── Preview Specialty Vote Results ──────────────────────────────────────────

  router.get('/preview-vote-results', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

    // Get all specialty votes
    db.all(`SELECT * FROM specialty_votes WHERE is_active = 1 ORDER BY vote_name`, (err, specialtyVotes) => {
      if (err) specialtyVotes = [];

      // Get vote counts per car for each specialty vote
      db.all(`
        SELECT svr.specialty_vote_id, svr.car_id,
               c.year, c.make, c.model, c.voter_id,
               COUNT(*) as vote_count
        FROM specialty_vote_results svr
        JOIN cars c ON svr.car_id = c.car_id
        GROUP BY svr.specialty_vote_id, svr.car_id
        ORDER BY svr.specialty_vote_id, vote_count DESC
      `, (err, voteResults) => {
        if (err) voteResults = [];

        // Build results by specialty vote
        const resultsByVote = {};
        voteResults.forEach(vr => {
          if (!resultsByVote[vr.specialty_vote_id]) {
            resultsByVote[vr.specialty_vote_id] = [];
          }
          resultsByVote[vr.specialty_vote_id].push(vr);
        });

        const voteCards = specialtyVotes.map(sv => {
          const results = resultsByVote[sv.specialty_vote_id] || [];
          const winner = results[0];

          const winnerDisplay = winner
            ? `
              <div style="background:var(--gold-bg);border:2px solid var(--gold-border);border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">🏆</div>
                <div style="font-size:18px;font-weight:bold;color:var(--heading-alt);">${winner.year || ''} ${winner.make} ${winner.model}</div>
                <div style="color:var(--text-secondary);margin-top:5px;">Voter ID: ${winner.voter_id || 'N/A'}</div>
                <div style="margin-top:10px;background:var(--success-color);color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-weight:600;">${winner.vote_count} votes</div>
              </div>
            `
            : '<p style="color:var(--text-muted);text-align:center;">No votes cast yet</p>';

          return `
            <div style="background:var(--modal-content-bg);border:1px solid var(--card-border);border-radius:8px;padding:20px;margin-bottom:20px;">
              <h4 style="margin:0 0 15px 0;color:var(--heading-alt);border-bottom:2px solid var(--badge-purple-bg);padding-bottom:10px;">${sv.vote_name}</h4>
              ${winnerDisplay}
            </div>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview Vote Results - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}

              ${getAdminNav('voting', chatEnabled)}

              <h3 class="section-title">Preview Specialty Vote Winners</h3>
              <p style="color:var(--text-secondary);margin-bottom:20px;">This is a preview. Results are not yet published.</p>

              ${voteCards || '<p>No specialty votes configured</p>'}

              <div style="margin-top:20px;">
                <a href="/admin/vote-status" class="action-btn" style="background:var(--text-secondary);">Back to Vote Status</a>
                ${appConfig.specialtyVotingStatus !== 'Lock'
                  ? `<a href="/admin/lock-specialty-voting" class="action-btn" style="background:var(--btn-delete-bg);" onclick="return confirm('Lock voting and publish these results?')">Lock & Publish Results</a>`
                  : ''
                }
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  // ─── Lock Specialty Voting & Publish Results ─────────────────────────────────

  router.get('/lock-specialty-voting', requireAdmin, (req, res) => {
    appConfig.specialtyVotingStatus = 'Lock';
    saveConfig();

    // Clear any existing published specialty results
    db.run(`DELETE FROM published_results WHERE result_type = 'specialty'`, (err) => {
      // Get winners for each specialty vote
      db.all(`
        SELECT svr.specialty_vote_id, svr.car_id, COUNT(*) as vote_count
        FROM specialty_vote_results svr
        GROUP BY svr.specialty_vote_id, svr.car_id
        ORDER BY svr.specialty_vote_id, vote_count DESC
      `, (err, results) => {
        if (err) results = [];

        // Get top winner for each specialty vote
        const winners = {};
        results.forEach(r => {
          if (!winners[r.specialty_vote_id]) {
            winners[r.specialty_vote_id] = r;
          }
        });

        const insertValues = [];
        Object.keys(winners).forEach(voteId => {
          const w = winners[voteId];
          insertValues.push('specialty', voteId, w.car_id, 1, w.vote_count);
        });

        if (insertValues.length === 0) {
          const io = req.app.get('io');
          io.to('role:all').emit('notification', { message: 'Votes sent to Judges for review', icon: '\uD83D\uDCE8' });
          res.redirect('/admin/vote-status');
          return;
        }

        const placeholders = [];
        for (let i = 0; i < insertValues.length; i += 5) {
          placeholders.push('(?, ?, ?, ?, ?)');
        }

        db.run(`INSERT INTO published_results (result_type, specialty_vote_id, car_id, place, total_score) VALUES ${placeholders.join(', ')}`, insertValues, (err) => {
          const io = req.app.get('io');
          io.to('role:all').emit('notification', { message: 'Votes sent to Judges for review', icon: '\uD83D\uDCE8' });
          res.redirect('/admin/vote-status');
        });
      });
    });
  });

  // ─── Open Specialty Voting ───────────────────────────────────────────────────

  router.get('/open-specialty-voting', requireAdmin, (req, res) => {
    appConfig.specialtyVotingStatus = 'Open';
    saveConfig();
    const io = req.app.get('io');
    io.to('role:all').emit('notification', { message: "Cast your vote by clicking 'Vote Here!'", icon: '\uD83D\uDDF3\uFE0F' });
    res.redirect('/admin/vote-status');
  });

  // ─── Close Specialty Voting ──────────────────────────────────────────────────

  router.get('/close-specialty-voting', requireAdmin, (req, res) => {
    appConfig.specialtyVotingStatus = 'Close';
    saveConfig();
    res.redirect('/admin/vote-status');
  });

  return router;
};
