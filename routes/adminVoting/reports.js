// routes/adminVoting/reports.js - Routes for report viewing and export
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { styles, adminStyles, getBodyTag, getAppBgStyles, getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav } = require('./shared');

  // ─── Reports Index Page ──────────────────────────────────────────────────────

  router.get('/reports', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);

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
                  ${getAppBgStyles(appConfig)}
                </head>
                ${getBodyTag(req)}
                  <div class="container dashboard-container">
                    ${adminHeader(user)}

                    ${getAdminNav('reports', chatEnabled)}

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
    const chatEnabled = isChatEnabled(appConfig, user);

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
          ${getAppBgStyles(appConfig)}
        </head>
        ${getBodyTag(req)}
          <div class="container dashboard-container">
            ${adminHeader(user)}

            ${getAdminNav('reports', chatEnabled)}

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
