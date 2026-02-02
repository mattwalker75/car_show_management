// routes/adminVoting.js - Admin voting control, judge status, specialty vote status, and reports
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload, saveConfig) {
  const { requireAdmin } = require('../middleware/auth');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getAvatarContent, adminNav } = require('../views/components');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script><script src="/socket.io/socket.io.js"></script><script src="/js/notifications.js"></script>';
  const appBgStyles = () => getAppBackgroundStyles(appConfig);
  const bodyTag = (req) => `<body data-user-role="${req.session && req.session.user ? req.session.user.role : ''}">`;

  // ─── Judge Status Page ───────────────────────────────────────────────────────

  router.get('/judge-status', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get all judges
    db.all(`SELECT user_id, name FROM users WHERE role = 'judge' AND is_active = 1 ORDER BY name`, (err, judges) => {
      if (err) judges = [];

      // Get all cars with their classes
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
               cl.class_name, cl.class_id, v.vehicle_name
        FROM cars c
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        WHERE c.is_active = 1
        ORDER BY cl.class_name, c.make, c.model
      `, (err, cars) => {
        if (err) cars = [];

        // Get all judge scores
        db.all(`
          SELECT js.*, u.name as judge_name, jq.question, jq.max_score
          FROM judge_scores js
          JOIN users u ON js.judge_id = u.user_id
          JOIN judge_questions jq ON js.question_id = jq.judge_question_id
          ORDER BY js.car_id, u.name
        `, (err, scores) => {
          if (err) scores = [];

          // Calculate total scores per car per judge
          const carScores = {};
          scores.forEach(s => {
            const key = `${s.car_id}-${s.judge_id}`;
            if (!carScores[key]) {
              carScores[key] = { judge_name: s.judge_name, judge_id: s.judge_id, car_id: s.car_id, total: 0, count: 0 };
            }
            carScores[key].total += s.score;
            carScores[key].count++;
          });

          // Build rows for each car
          const carRows = cars.map(car => {
            const carJudgeScores = Object.values(carScores).filter(cs => cs.car_id === car.car_id);
            const totalScore = carJudgeScores.reduce((sum, cs) => sum + cs.total, 0);
            const avgScore = carJudgeScores.length > 0 ? (totalScore / carJudgeScores.length).toFixed(1) : '-';

            const judgeDetails = carJudgeScores.map(cs =>
              `<span style="background:#3498db;color:white;padding:2px 8px;border-radius:10px;font-size:11px;margin:2px;">${cs.judge_name}: ${cs.total}</span>`
            ).join(' ');

            return `
              <tr>
                <td>${car.voter_id || '-'}</td>
                <td>${car.year || ''} ${car.make} ${car.model}</td>
                <td>${car.class_name || 'Unassigned'}</td>
                <td>${judgeDetails || '<span style="color:#999;">No scores yet</span>'}</td>
                <td><strong>${avgScore}</strong></td>
                <td>
                  <a href="/admin/edit-judge-scores/${car.car_id}" class="action-btn edit">Edit Scores</a>
                </td>
              </tr>
            `;
          }).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Judge Status - Admin</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
        ${appBgStyles()}
            </head>
            ${bodyTag(req)}
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Admin Dashboard</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/admin/dashboard">Dashboard</a>
                  <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                  <a href="/admin">Users</a>
                  <a href="/admin/vehicles">Vehicles</a>
                  <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                  <a href="/admin/reports">Reports</a>
                  <a href="/admin/vendors">Vendors</a>
                  <a href="/user/vote">Vote Here!</a>
                </div>

                <h3 class="section-title">Judge Voting Status</h3>

                <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                  <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; ${appConfig.judgeVotingStatus === 'Lock' ? 'background:#e74c3c;color:white;' : appConfig.judgeVotingStatus === 'Open' ? 'background:#27ae60;color:white;' : 'background:#999;color:white;'}">
                    ${appConfig.judgeVotingStatus === 'Lock' ? '🔒 Voting LOCKED' : appConfig.judgeVotingStatus === 'Open' ? '🔓 Voting OPEN' : '🚫 Voting CLOSED'}
                  </span>
                  <a href="/admin/preview-judge-results" class="action-btn" style="background:#3498db;">Preview Results</a>
                  ${appConfig.judgeVotingStatus === 'Close' ? `
                    <a href="/admin/open-judge-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Open voting? Judges will be able to score vehicles.')">Open Voting</a>
                  ` : appConfig.judgeVotingStatus === 'Open' ? `
                    <a href="/admin/close-judge-voting" class="action-btn" style="background:#999;" onclick="return confirm('Close voting? Judges will no longer be able to vote.')">Close Voting</a>
                    <a href="/admin/lock-judge-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish results? Judges will no longer be able to vote.')">Lock & Publish Results</a>
                  ` : `
                    <a href="/admin/open-judge-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Reopen voting? Judges will be able to vote again.')">Open Voting</a>
                  `}
                </div>

                <div style="overflow-x: auto;">
                  <table class="data-table" style="min-width: 700px;">
                    <thead>
                      <tr>
                        <th>Voter ID</th>
                        <th>Vehicle</th>
                        <th>Class</th>
                        <th>Judge Scores</th>
                        <th>Avg Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${carRows || '<tr><td colspan="6" style="text-align:center;color:#999;">No cars registered</td></tr>'}
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
  });

  // ─── Edit Judge Scores for a Car ─────────────────────────────────────────────

  router.get('/edit-judge-scores/:carId', requireAdmin, (req, res) => {
    const carId = req.params.carId;
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get car details
    db.get(`
      SELECT c.*, cl.class_name, v.vehicle_id, v.vehicle_name
      FROM cars c
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      WHERE c.car_id = ?
    `, [carId], (err, car) => {
      if (err || !car) {
        res.redirect('/admin/judge-status');
        return;
      }

      // Get all judges
      db.all(`SELECT user_id, name FROM users WHERE role = 'judge' AND is_active = 1 ORDER BY name`, (err, judges) => {
        if (err) judges = [];

        // Get all questions for this vehicle type
        db.all(`
          SELECT jq.*, jc.catagory_name
          FROM judge_questions jq
          JOIN judge_catagories jc ON jq.judge_catagory_id = jc.judge_catagory_id
          WHERE jq.vehicle_id = ? AND jq.is_active = 1
          ORDER BY jc.display_order, jq.display_order
        `, [car.vehicle_id], (err, questions) => {
          if (err) questions = [];

          // Get existing scores for this car
          db.all(`
            SELECT js.*, u.name as judge_name
            FROM judge_scores js
            JOIN users u ON js.judge_id = u.user_id
            WHERE js.car_id = ?
          `, [carId], (err, scores) => {
            if (err) scores = [];

            // Create a map of scores
            const scoreMap = {};
            scores.forEach(s => {
              scoreMap[`${s.judge_id}-${s.question_id}`] = s.score;
            });

            // Build form rows for each judge
            const judgeRows = judges.map(judge => {
              const questionInputs = questions.map(q => {
                const key = `${judge.user_id}-${q.judge_question_id}`;
                const currentScore = scoreMap[key] !== undefined ? scoreMap[key] : '';
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f8f9fa;border-radius:4px;margin-bottom:5px;">
                    <span style="flex:1;font-size:13px;">${q.question} (${q.min_score}-${q.max_score})</span>
                    <input type="text" name="score_${judge.user_id}_${q.judge_question_id}"
                           value="${currentScore}" inputmode="numeric"
                           style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                  </div>
                `;
              }).join('');

              return `
                <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:15px;">
                  <h4 style="margin:0 0 10px 0;color:#2c3e50;">${judge.name}</h4>
                  ${questionInputs || '<p style="color:#999;">No questions configured for this vehicle type</p>'}
                </div>
              `;
            }).join('');

            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Edit Scores - Admin</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
                ${adminStyles}
        ${appBgStyles()}
              </head>
              ${bodyTag(req)}
                <div class="container dashboard-container">
                  <div class="dashboard-header">
                    <h1>🏎️ Admin Dashboard</h1>
                    <div class="user-info">
                      <div class="user-avatar">${avatarContent}</div>
                      <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                    </div>
                  </div>

                  <div class="admin-nav">
                    <a href="/admin/dashboard">Dashboard</a>
                    <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                    <a href="/admin">Users</a>
                    <a href="/admin/vehicles">Vehicles</a>
                    <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                    <a href="/admin/reports">Reports</a>
                    <a href="/admin/vendors">Vendors</a>
                    <a href="/user/vote">Vote Here!</a>
                  </div>

                  <h3 class="section-title">Edit Scores: ${car.year || ''} ${car.make} ${car.model}</h3>
                  <p style="color:#666;margin-bottom:20px;">Class: ${car.class_name || 'Unassigned'} | Voter ID: ${car.voter_id || 'N/A'}</p>

                  <form method="POST" action="/admin/save-judge-scores/${carId}">
                    ${judgeRows || '<p>No judges available</p>'}
                    <div style="margin-top:20px;">
                      <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save All Scores</button>
                      <a href="/admin/judge-status" style="margin-left:10px;color:#666;">Cancel</a>
                    </div>
                  </form>
                </div>
              </body>
              </html>
            `);
          });
        });
      });
    });
  });

  // ─── Save Edited Judge Scores ────────────────────────────────────────────────

  router.post('/save-judge-scores/:carId', requireAdmin, (req, res) => {
    const carId = req.params.carId;
    const body = req.body;

    // Extract all scores from form
    const scoreUpdates = [];
    for (const key in body) {
      if (key.startsWith('score_')) {
        const parts = key.split('_');
        const judgeId = parts[1];
        const questionId = parts[2];
        const score = body[key];
        if (score !== '') {
          scoreUpdates.push({ judgeId, questionId, score: parseInt(score) });
        }
      }
    }

    // Delete existing scores for this car and re-insert
    db.run('DELETE FROM judge_scores WHERE car_id = ?', [carId], (err) => {
      if (scoreUpdates.length === 0) {
        res.redirect('/admin/judge-status');
        return;
      }

      const placeholders = scoreUpdates.map(() => '(?, ?, ?, ?)').join(', ');
      const values = [];
      scoreUpdates.forEach(su => {
        values.push(su.judgeId, carId, su.questionId, su.score);
      });

      db.run(`INSERT INTO judge_scores (judge_id, car_id, question_id, score) VALUES ${placeholders}`, values, (err) => {
        res.redirect('/admin/judge-status');
      });
    });
  });

  // ─── Preview Judge Results ───────────────────────────────────────────────────

  router.get('/preview-judge-results', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Get all classes
    db.all(`SELECT * FROM classes WHERE is_active = 1 ORDER BY class_name`, (err, classes) => {
      if (err) classes = [];

      // Get all cars with scores
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id, c.class_id,
               cl.class_name,
               SUM(js.score) as total_score,
               COUNT(DISTINCT js.judge_id) as judge_count
        FROM cars c
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN judge_scores js ON c.car_id = js.car_id
        WHERE c.is_active = 1
        GROUP BY c.car_id
        ORDER BY c.class_id, total_score DESC
      `, (err, cars) => {
        if (err) cars = [];

        // Group by class and get top 3
        const resultsByClass = {};
        classes.forEach(cl => {
          resultsByClass[cl.class_id] = {
            class_name: cl.class_name,
            cars: []
          };
        });

        cars.forEach(car => {
          if (car.class_id && resultsByClass[car.class_id]) {
            resultsByClass[car.class_id].cars.push(car);
          }
        });

        // Build results HTML
        const classResults = Object.values(resultsByClass).map(classData => {
          const top3 = classData.cars.slice(0, 3);
          const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

          const carsList = top3.map((car, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${idx === 0 ? '#fff9e6' : '#f8f9fa'};border-radius:6px;margin-bottom:8px;border:${idx === 0 ? '2px solid #f1c40f' : '1px solid #ddd'};">
              <span><strong>${placeLabels[idx]}</strong> - ${car.year || ''} ${car.make} ${car.model} (ID: ${car.voter_id || 'N/A'})</span>
              <span style="background:#27ae60;color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${car.total_score || 0} pts</span>
            </div>
          `).join('');

          return `
            <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;">${classData.class_name}</h4>
              ${carsList || '<p style="color:#999;">No scored vehicles in this class</p>'}
            </div>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview Results - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/dashboard">Dashboard</a>
                <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Preview Judge Results - Top 3 by Class</h3>
              <p style="color:#666;margin-bottom:20px;">This is a preview. Results are not yet published.</p>

              ${classResults || '<p>No classes configured</p>'}

              <div style="margin-top:20px;">
                <a href="/admin/judge-status" class="action-btn" style="background:#666;">Back to Judge Status</a>
                ${appConfig.judgeVotingStatus !== 'Lock'
                  ? `<a href="/admin/lock-judge-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish these results?')">Lock & Publish Results</a>`
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

  // ─── Lock Judge Voting & Publish Results ─────────────────────────────────────

  router.get('/lock-judge-voting', requireAdmin, (req, res) => {
    appConfig.judgeVotingStatus = 'Lock';
    saveConfig();

    // Clear any existing published judge results
    db.run(`DELETE FROM published_results WHERE result_type = 'judge'`, (err) => {
      // Get all classes
      db.all(`SELECT * FROM classes WHERE is_active = 1`, (err, classes) => {
        if (err || !classes || classes.length === 0) {
          res.redirect('/admin/judge-status');
          return;
        }

        // Get all cars with scores grouped by class
        db.all(`
          SELECT c.car_id, c.class_id,
                 SUM(js.score) as total_score
          FROM cars c
          LEFT JOIN judge_scores js ON c.car_id = js.car_id
          WHERE c.is_active = 1 AND c.class_id IS NOT NULL
          GROUP BY c.car_id
          ORDER BY c.class_id, total_score DESC
        `, (err, cars) => {
          if (err) cars = [];

          // Group by class and insert top 3
          const insertValues = [];
          const resultsByClass = {};

          cars.forEach(car => {
            if (!resultsByClass[car.class_id]) {
              resultsByClass[car.class_id] = [];
            }
            if (resultsByClass[car.class_id].length < 3) {
              resultsByClass[car.class_id].push(car);
            }
          });

          Object.keys(resultsByClass).forEach(classId => {
            resultsByClass[classId].forEach((car, idx) => {
              insertValues.push('judge', classId, car.car_id, idx + 1, car.total_score || 0);
            });
          });

          if (insertValues.length === 0) {
            const io = req.app.get('io');
            io.to('role:judge').emit('notification', { message: 'Judge Voting results are published', icon: '\uD83C\uDFC6' });
            res.redirect('/admin/judge-status');
            return;
          }

          const placeholders = [];
          for (let i = 0; i < insertValues.length; i += 5) {
            placeholders.push('(?, ?, ?, ?, ?)');
          }

          db.run(`INSERT INTO published_results (result_type, class_id, car_id, place, total_score) VALUES ${placeholders.join(', ')}`, insertValues, (err) => {
            const io = req.app.get('io');
            io.to('role:judge').emit('notification', { message: 'Judge Voting results are published', icon: '\uD83C\uDFC6' });
            res.redirect('/admin/judge-status');
          });
        });
      });
    });
  });

  // ─── Open Judge Voting ───────────────────────────────────────────────────────

  router.get('/open-judge-voting', requireAdmin, (req, res) => {
    appConfig.judgeVotingStatus = 'Open';
    saveConfig();
    const io = req.app.get('io');
    io.to('role:judge').emit('notification', { message: 'Judge Voting is open', icon: '\uD83D\uDD13' });
    res.redirect('/admin/judge-status');
  });

  // ─── Close Judge Voting ──────────────────────────────────────────────────────

  router.get('/close-judge-voting', requireAdmin, (req, res) => {
    appConfig.judgeVotingStatus = 'Close';
    saveConfig();
    const io = req.app.get('io');
    io.to('role:judge').emit('notification', { message: 'Judge Voting is closed', icon: '\uD83D\uDD12' });
    res.redirect('/admin/judge-status');
  });

  // ─── Specialty Vote Status Page ──────────────────────────────────────────────

  router.get('/vote-status', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
              <td><span style="background:#27ae60;color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${sv.total_votes}</span></td>
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
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/dashboard">Dashboard</a>
                <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Specialty Vote Status</h3>

              <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; ${appConfig.specialtyVotingStatus === 'Lock' ? 'background:#e74c3c;color:white;' : appConfig.specialtyVotingStatus === 'Open' ? 'background:#27ae60;color:white;' : 'background:#95a5a6;color:white;'}">
                  ${appConfig.specialtyVotingStatus === 'Lock' ? '🔒 Voting LOCKED' : appConfig.specialtyVotingStatus === 'Open' ? '🔓 Voting OPEN' : '🚫 Voting CLOSED'}
                </span>
                <a href="/admin/preview-vote-results" class="action-btn" style="background:#3498db;">Preview Results</a>
                ${appConfig.specialtyVotingStatus === 'Close' ? `
                  <a href="/admin/open-specialty-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Open voting? Users will be able to vote.')">Open Voting</a>
                ` : appConfig.specialtyVotingStatus === 'Open' ? `
                  <a href="/admin/close-specialty-voting" class="action-btn" style="background:#95a5a6;" onclick="return confirm('Close voting? Users will no longer be able to vote.')">Close Voting</a>
                  <a href="/admin/lock-specialty-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish results? Users will no longer be able to vote.')">Lock & Publish Results</a>
                ` : `
                  <a href="/admin/open-specialty-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Open voting? Users will be able to vote again.')">Open Voting</a>
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
                    ${voteRows || '<tr><td colspan="5" style="text-align:center;color:#999;">No specialty votes configured</td></tr>'}
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
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
              <a href="/admin/delete-vote-result/${r.id}?voteId=${voteId}" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Delete this vote?')">Delete</a>
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
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/dashboard">Dashboard</a>
                <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">${vote.vote_name} - All Votes</h3>
              <p style="color:#666;margin-bottom:20px;">Total votes: ${results.length}</p>

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
                    ${resultRows || '<tr><td colspan="4" style="text-align:center;color:#999;">No votes cast</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div style="margin-top:20px;">
                <a href="/admin/vote-status" class="action-btn" style="background:#666;">Back to Vote Status</a>
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
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

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
              <div style="background:#fff9e6;border:2px solid #f1c40f;border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">🏆</div>
                <div style="font-size:18px;font-weight:bold;color:#2c3e50;">${winner.year || ''} ${winner.make} ${winner.model}</div>
                <div style="color:#666;margin-top:5px;">Voter ID: ${winner.voter_id || 'N/A'}</div>
                <div style="margin-top:10px;background:#27ae60;color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-weight:600;">${winner.vote_count} votes</div>
              </div>
            `
            : '<p style="color:#999;text-align:center;">No votes cast yet</p>';

          return `
            <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #9b59b6;padding-bottom:10px;">${sv.vote_name}</h4>
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
        ${appBgStyles()}
          </head>
          ${bodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/dashboard">Dashboard</a>
                <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Vehicles</a>
                <a href="#" class="active" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
              </div>

              <h3 class="section-title">Preview Specialty Vote Winners</h3>
              <p style="color:#666;margin-bottom:20px;">This is a preview. Results are not yet published.</p>

              ${voteCards || '<p>No specialty votes configured</p>'}

              <div style="margin-top:20px;">
                <a href="/admin/vote-status" class="action-btn" style="background:#666;">Back to Vote Status</a>
                ${appConfig.specialtyVotingStatus !== 'Lock'
                  ? `<a href="/admin/lock-specialty-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish these results?')">Lock & Publish Results</a>`
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

  // ─── Reports Index Page ──────────────────────────────────────────────────────

  router.get('/reports', requireAdmin, (req, res) => {
    const user = req.session.user;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    // Gather counts for each report
    db.get('SELECT COUNT(*) as cnt FROM users', (err, userCount) => {
      db.get('SELECT COUNT(*) as cnt FROM cars', (err, carCount) => {
        db.get('SELECT COUNT(*) as cnt FROM classes', (err, classCount) => {
          db.get('SELECT COUNT(*) as cnt FROM specialty_votes', (err, svCount) => {
            db.get('SELECT COUNT(*) as cnt FROM judge_catagories', (err, catCount) => {

              const reports = [
                {
                  id: 'users',
                  title: 'Users & Contact Information',
                  description: 'List of all users with their name, username, email, phone, role, and account status.',
                  count: (userCount ? userCount.cnt : 0) + ' users'
                },
                {
                  id: 'vehicles-winners',
                  title: 'Registered Vehicles with Winners',
                  description: 'All registered vehicles with owner info and any places won in judging or specialty votes.',
                  count: (carCount ? carCount.cnt : 0) + ' vehicles'
                },
                {
                  id: 'vehicles-classes',
                  title: 'Vehicles by Class',
                  description: 'All vehicles grouped with their assigned vehicle type and competition class.',
                  count: (classCount ? classCount.cnt : 0) + ' classes'
                },
                {
                  id: 'specialty-votes',
                  title: 'Specialty Votes',
                  description: 'All specialty vote categories with their configuration, voter counts, and vote tallies.',
                  count: (svCount ? svCount.cnt : 0) + ' votes'
                },
                {
                  id: 'judging-config',
                  title: 'Judging Categories, Questions & Scoring',
                  description: 'Complete judging configuration including categories, questions, and score ranges.',
                  count: (catCount ? catCount.cnt : 0) + ' categories'
                }
              ];

              const reportCards = reports.map(r => `
                <div class="profile-card" style="margin-bottom:15px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                    <div style="flex:1;min-width:200px;">
                      <h4 style="margin:0 0 5px 0;">${r.title}</h4>
                      <p style="color:#666;margin:0 0 8px 0;font-size:14px;">${r.description}</p>
                      <span style="background:#3498db;color:white;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${r.count}</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <a href="/admin/reports/view/${r.id}" class="action-btn" style="background:#27ae60;">View</a>
                      <a href="/admin/reports/export/${r.id}" class="action-btn" style="background:#3498db;">Export CSV</a>
                    </div>
                  </div>
                </div>
              `).join('');

              res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Reports - Admin</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                  ${styles}
                  ${adminStyles}
        ${appBgStyles()}
                </head>
                ${bodyTag(req)}
                  <div class="container dashboard-container">
                    <div class="dashboard-header">
                      <h1>🏎️ Admin Dashboard</h1>
                      <div class="user-info">
                        <div class="user-avatar">${avatarContent}</div>
                        <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                      </div>
                    </div>

                    <div class="admin-nav">
                      <a href="/admin/dashboard">Dashboard</a>
                      <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
                      <a href="/admin">Users</a>
                      <a href="/admin/vehicles">Vehicles</a>
                      <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
                      <a href="/admin/reports" class="active">Reports</a>
                      <a href="/admin/vendors">Vendors</a>
                      <a href="/user/vote">Vote Here!</a>
                    </div>

                    <h3 class="section-title">Reports</h3>
                    <p style="color:#666;margin-bottom:15px;">View and export reports as CSV files.</p>

                    ${reportCards}
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
      });
    });
  });

  // ─── View a Specific Report ──────────────────────────────────────────────────

  router.get('/reports/view/:reportId', requireAdmin, (req, res) => {
    const user = req.session.user;
    const reportId = req.params.reportId;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarContent = user.image_url
      ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : initials;

    const renderReport = (title, headers, rows, colSpan) => {
      const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
      const rowHtml = rows.length > 0
        ? rows.join('')
        : `<tr><td colspan="${colSpan}" style="text-align:center;color:#666;">No data found.</td></tr>`;

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title} - Reports - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        ${appBgStyles()}
        </head>
        ${bodyTag(req)}
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="#" class="profile-btn" onclick="const p=window.location.pathname;window.location.href=p.startsWith('/admin')?'/admin/profile':p.startsWith('/judge')?'/judge/profile':p.startsWith('/registrar')?'/registrar/profile':'/user/profile';return false;">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Vehicles</a>
              <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;">Voting</a>
              <a href="/admin/reports" class="active">Reports</a>
                <a href="/admin/vendors">Vendors</a>
                <a href="/user/vote">Vote Here!</a>
            </div>

            <h3 class="section-title">${title}</h3>
            <div style="margin-bottom:15px;">
              <a href="/admin/reports/export/${reportId}" class="action-btn" style="background:#3498db;">Export CSV</a>
              <a href="/admin/reports" class="action-btn" style="background:#6c757d;">Back to Reports</a>
            </div>

            <div class="table-wrapper report-table">
              <table class="user-table">
                <thead>
                  <tr>${headerHtml}</tr>
                </thead>
                <tbody>
                  ${rowHtml}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    if (reportId === 'users') {
      db.all('SELECT name, username, email, phone, role, is_active, created_at FROM users ORDER BY name', (err, users) => {
        if (err) users = [];
        const headers = ['Name', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Created'];
        const rows = users.map(u => `
          <tr>
            <td>${u.name}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${u.phone || '-'}</td>
            <td>${u.role}</td>
            <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>${u.created_at || '-'}</td>
          </tr>
        `);
        res.send(renderReport('Users & Contact Information', headers, rows, 7));
      });

    } else if (reportId === 'vehicles-winners') {
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
               v.vehicle_name, cl.class_name, u.name as owner_name,
               c.is_active
        FROM cars c
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN users u ON c.user_id = u.user_id
        ORDER BY u.name, c.make, c.model
      `, (err, cars) => {
        if (err) cars = [];

        // Get published results
        db.all(`
          SELECT pr.car_id, pr.result_type, pr.place, pr.total_score,
                 cl.class_name, sv.vote_name
          FROM published_results pr
          LEFT JOIN classes cl ON pr.class_id = cl.class_id
          LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
          ORDER BY pr.car_id, pr.result_type, pr.place
        `, (err, results) => {
          if (err) results = [];

          // Group results by car_id
          const resultsByCarId = {};
          results.forEach(r => {
            if (!resultsByCarId[r.car_id]) resultsByCarId[r.car_id] = [];
            const placeLabel = r.place === 1 ? '1st' : r.place === 2 ? '2nd' : '3rd';
            if (r.result_type === 'judge') {
              resultsByCarId[r.car_id].push(`${placeLabel} - ${r.class_name || 'N/A'} (Judge, ${r.total_score} pts)`);
            } else {
              resultsByCarId[r.car_id].push(`${placeLabel} - ${r.vote_name || 'N/A'} (Special Vote, ${r.total_score} votes)`);
            }
          });

          const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Type', 'Class', 'Owner', 'Status', 'Awards'];
          const rows = cars.map(c => {
            const awards = resultsByCarId[c.car_id] ? resultsByCarId[c.car_id].join('; ') : '-';
            return `
              <tr>
                <td>${c.voter_id || '-'}</td>
                <td>${c.year || '-'}</td>
                <td>${c.make}</td>
                <td>${c.model}</td>
                <td>${c.vehicle_name || '-'}</td>
                <td>${c.class_name || '-'}</td>
                <td>${c.owner_name || '-'}</td>
                <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="white-space:normal;max-width:250px;">${awards}</td>
              </tr>
            `;
          });
          res.send(renderReport('Registered Vehicles with Winners', headers, rows, 9));
        });
      });

    } else if (reportId === 'vehicles-classes') {
      db.all(`
        SELECT c.voter_id, c.year, c.make, c.model,
               v.vehicle_name, cl.class_name
        FROM cars c
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        ORDER BY v.vehicle_name, cl.class_name, c.make, c.model
      `, (err, cars) => {
        if (err) cars = [];
        const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Vehicle Type', 'Class'];
        const rows = cars.map(c => `
          <tr>
            <td>${c.voter_id || '-'}</td>
            <td>${c.year || '-'}</td>
            <td>${c.make}</td>
            <td>${c.model}</td>
            <td>${c.vehicle_name || '-'}</td>
            <td>${c.class_name || '-'}</td>
          </tr>
        `);
        res.send(renderReport('Vehicles by Class', headers, rows, 6));
      });

    } else if (reportId === 'specialty-votes') {
      db.all(`
        SELECT sv.*,
               (SELECT COUNT(*) FROM specialty_vote_voters WHERE specialty_vote_id = sv.specialty_vote_id) as voter_count,
               (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count
        FROM specialty_votes sv
        ORDER BY sv.vote_name
      `, (err, votes) => {
        if (err) votes = [];
        const headers = ['Name', 'Description', 'Who Can Vote', 'Assigned Voters', 'Votes Cast', 'Status'];
        const rows = votes.map(sv => `
          <tr>
            <td>${sv.vote_name}</td>
            <td>${sv.description || '-'}</td>
            <td>${sv.allow_all_users ? 'All Users' : 'Specific Users'}</td>
            <td>${sv.allow_all_users ? 'All' : sv.voter_count}</td>
            <td>${sv.vote_count}</td>
            <td><span class="status-badge ${sv.is_active ? 'active' : 'inactive'}">${sv.is_active ? 'Active' : 'Inactive'}</span></td>
          </tr>
        `);
        res.send(renderReport('Specialty Votes', headers, rows, 6));
      });

    } else if (reportId === 'judging-config') {
      db.all(`
        SELECT jc.catagory_name, v.vehicle_name, jc.display_order as cat_order,
               jq.question, jq.min_score, jq.max_score, jq.display_order as q_order,
               jq.is_active as q_active, jc.is_active as cat_active
        FROM judge_catagories jc
        LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
        LEFT JOIN judge_questions jq ON jq.judge_catagory_id = jc.judge_catagory_id
        ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name, jq.display_order
      `, (err, data) => {
        if (err) data = [];
        const headers = ['Vehicle Type', 'Category', 'Cat Order', 'Cat Status', 'Question', 'Min Score', 'Max Score', 'Q Order', 'Q Status'];
        const rows = data.map(d => `
          <tr>
            <td>${d.vehicle_name || '-'}</td>
            <td>${d.catagory_name}</td>
            <td>${d.cat_order}</td>
            <td><span class="status-badge ${d.cat_active ? 'active' : 'inactive'}">${d.cat_active ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space:normal;">${d.question || '<em style="color:#999;">No questions</em>'}</td>
            <td>${d.min_score != null ? d.min_score : '-'}</td>
            <td>${d.max_score != null ? d.max_score : '-'}</td>
            <td>${d.q_order != null ? d.q_order : '-'}</td>
            <td>${d.q_active != null ? `<span class="status-badge ${d.q_active ? 'active' : 'inactive'}">${d.q_active ? 'Active' : 'Inactive'}</span>` : '-'}</td>
          </tr>
        `);
        res.send(renderReport('Judging Categories, Questions & Scoring', headers, rows, 9));
      });

    } else {
      res.redirect('/admin/reports');
    }
  });

  // ─── Export Report as CSV ────────────────────────────────────────────────────

  router.get('/reports/export/:reportId', requireAdmin, (req, res) => {
    const reportId = req.params.reportId;

    const sendCsv = (filename, headers, rows) => {
      const escapeCsv = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => row.map(escapeCsv).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    };

    if (reportId === 'users') {
      db.all('SELECT name, username, email, phone, role, is_active, created_at FROM users ORDER BY name', (err, users) => {
        if (err) users = [];
        const headers = ['Name', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Created'];
        const rows = users.map(u => [
          u.name, u.username, u.email, u.phone || '', u.role,
          u.is_active ? 'Active' : 'Inactive', u.created_at || ''
        ]);
        sendCsv('users_report.csv', headers, rows);
      });

    } else if (reportId === 'vehicles-winners') {
      db.all(`
        SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
               v.vehicle_name, cl.class_name, u.name as owner_name,
               c.is_active
        FROM cars c
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN users u ON c.user_id = u.user_id
        ORDER BY u.name, c.make, c.model
      `, (err, cars) => {
        if (err) cars = [];

        db.all(`
          SELECT pr.car_id, pr.result_type, pr.place, pr.total_score,
                 cl.class_name, sv.vote_name
          FROM published_results pr
          LEFT JOIN classes cl ON pr.class_id = cl.class_id
          LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
          ORDER BY pr.car_id, pr.result_type, pr.place
        `, (err, results) => {
          if (err) results = [];

          const resultsByCarId = {};
          results.forEach(r => {
            if (!resultsByCarId[r.car_id]) resultsByCarId[r.car_id] = [];
            const placeLabel = r.place === 1 ? '1st' : r.place === 2 ? '2nd' : '3rd';
            if (r.result_type === 'judge') {
              resultsByCarId[r.car_id].push(`${placeLabel} - ${r.class_name || 'N/A'} (Judge, ${r.total_score} pts)`);
            } else {
              resultsByCarId[r.car_id].push(`${placeLabel} - ${r.vote_name || 'N/A'} (Special Vote, ${r.total_score} votes)`);
            }
          });

          const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Type', 'Class', 'Owner', 'Status', 'Awards'];
          const rows = cars.map(c => [
            c.voter_id || '', c.year || '', c.make, c.model,
            c.vehicle_name || '', c.class_name || '', c.owner_name || '',
            c.is_active ? 'Active' : 'Inactive',
            resultsByCarId[c.car_id] ? resultsByCarId[c.car_id].join('; ') : ''
          ]);
          sendCsv('vehicles_winners_report.csv', headers, rows);
        });
      });

    } else if (reportId === 'vehicles-classes') {
      db.all(`
        SELECT c.voter_id, c.year, c.make, c.model,
               v.vehicle_name, cl.class_name
        FROM cars c
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        ORDER BY v.vehicle_name, cl.class_name, c.make, c.model
      `, (err, cars) => {
        if (err) cars = [];
        const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Vehicle Type', 'Class'];
        const rows = cars.map(c => [
          c.voter_id || '', c.year || '', c.make, c.model,
          c.vehicle_name || '', c.class_name || ''
        ]);
        sendCsv('vehicles_classes_report.csv', headers, rows);
      });

    } else if (reportId === 'specialty-votes') {
      db.all(`
        SELECT sv.*,
               (SELECT COUNT(*) FROM specialty_vote_voters WHERE specialty_vote_id = sv.specialty_vote_id) as voter_count,
               (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count
        FROM specialty_votes sv
        ORDER BY sv.vote_name
      `, (err, votes) => {
        if (err) votes = [];
        const headers = ['Name', 'Description', 'Who Can Vote', 'Assigned Voters', 'Votes Cast', 'Status'];
        const rows = votes.map(sv => [
          sv.vote_name, sv.description || '', sv.allow_all_users ? 'All Users' : 'Specific Users',
          sv.allow_all_users ? 'All' : String(sv.voter_count), String(sv.vote_count),
          sv.is_active ? 'Active' : 'Inactive'
        ]);
        sendCsv('specialty_votes_report.csv', headers, rows);
      });

    } else if (reportId === 'judging-config') {
      db.all(`
        SELECT jc.catagory_name, v.vehicle_name, jc.display_order as cat_order,
               jq.question, jq.min_score, jq.max_score, jq.display_order as q_order,
               jq.is_active as q_active, jc.is_active as cat_active
        FROM judge_catagories jc
        LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
        LEFT JOIN judge_questions jq ON jq.judge_catagory_id = jc.judge_catagory_id
        ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name, jq.display_order
      `, (err, data) => {
        if (err) data = [];
        const headers = ['Vehicle Type', 'Category', 'Cat Order', 'Cat Status', 'Question', 'Min Score', 'Max Score', 'Q Order', 'Q Status'];
        const rows = data.map(d => [
          d.vehicle_name || '', d.catagory_name, String(d.cat_order),
          d.cat_active ? 'Active' : 'Inactive',
          d.question || '', d.min_score != null ? String(d.min_score) : '',
          d.max_score != null ? String(d.max_score) : '',
          d.q_order != null ? String(d.q_order) : '',
          d.q_active != null ? (d.q_active ? 'Active' : 'Inactive') : ''
        ]);
        sendCsv('judging_config_report.csv', headers, rows);
      });

    } else {
      res.redirect('/admin/reports');
    }
  });

  return router;
};
