// routes/adminVoting/judgeStatus.js - Routes for judge voting status and scores
const express = require('express');

module.exports = function (db, appConfig, upload, saveConfig) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { styles, adminStyles, getBodyTag, getAppBgStyles, getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav } = require('./shared');

  // ─── Judge Status Page ───────────────────────────────────────────────────────

  router.get('/judge-status', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

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
              ${getAppBgStyles(appConfig)}
            </head>
            ${getBodyTag(req)}
              <div class="container dashboard-container">
                ${adminHeader(user)}

                ${getAdminNav('voting', chatEnabled)}

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
    const chatEnabled = isChatEnabled(appConfig, user);

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
                ${getAppBgStyles(appConfig)}
              </head>
              ${getBodyTag(req)}
                <div class="container dashboard-container">
                  ${adminHeader(user)}

                  ${getAdminNav('voting', chatEnabled)}

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
    const chatEnabled = isChatEnabled(appConfig, user);

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
            ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              ${adminHeader(user)}

              ${getAdminNav('voting', chatEnabled)}

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

  return router;
};
