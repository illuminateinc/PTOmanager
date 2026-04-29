const { Router } = require('express');
const { query } = require('../db/pool');
const { requireRole } = require('../middleware/rbac');

const router = Router();

const REQUEST_SELECT = `
  SELECT
    r.id,
    r.user_id            AS "employeeId",
    u.name               AS "employeeName",
    r.bucket,
    TO_CHAR(r.from_date, 'YYYY-MM-DD') AS "from",
    TO_CHAR(r.to_date,   'YYYY-MM-DD') AS "to",
    r.days::float        AS days,
    r.status,
    COALESCE(r.note, '') AS note,
    r.source,
    r.approved_by        AS "approvedBy",
    r.created_at         AS "createdAt"
  FROM pto_requests r
  JOIN users u ON r.user_id = u.id
`;

// GET /api/requests
router.get('/', async (req, res, next) => {
  try {
    let sql = REQUEST_SELECT;
    const params = [];

    if (req.user.role === 'employee') {
      sql += ` WHERE (u.cognito_sub = $1 OR u.email = $1)`;
      params.push(req.user.cognitoSub || req.user.email);
    } else if (req.user.role === 'manager') {
      sql += `
        WHERE u.cognito_sub = $1 OR u.email = $1
           OR u.manager_id = (SELECT id FROM users WHERE cognito_sub = $1 OR email = $1 LIMIT 1)
      `;
      params.push(req.user.cognitoSub || req.user.email);
    }

    sql += ` ORDER BY r.from_date DESC, r.id DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/requests
router.post('/', async (req, res, next) => {
  try {
    const { userId, bucket, from, to, days, note, source } = req.body;

    // Employees can only submit for themselves
    if (req.user.role === 'employee') {
      const me = await query(`SELECT id FROM users WHERE cognito_sub=$1 OR email=$1 LIMIT 1`, [req.user.cognitoSub || req.user.email]);
      if (!me.rows.length || me.rows[0].id !== parseInt(userId)) {
        return res.status(403).json({ error: 'Can only submit requests for yourself' });
      }
    }

    const result = await query(
      `INSERT INTO pto_requests (user_id, bucket, from_date, to_date, days, note, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, bucket, from, to, days, note || '', source || 'manual']
    );
    const id = result.rows[0].id;
    const full = await query(REQUEST_SELECT + ` WHERE r.id = $1`, [id]);
    res.status(201).json(full.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/requests/:id/approve  (manager/admin)
router.put('/:id/approve', requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const approver = await query(
      `SELECT id FROM users WHERE cognito_sub=$1 OR email=$1 LIMIT 1`,
      [req.user.cognitoSub || req.user.email]
    );
    const approverId = approver.rows[0]?.id || null;

    await query(
      `UPDATE pto_requests SET status='approved', approved_by=$1, updated_at=NOW() WHERE id=$2`,
      [approverId, req.params.id]
    );
    const full = await query(REQUEST_SELECT + ` WHERE r.id = $1`, [req.params.id]);
    res.json(full.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/requests/:id/deny  (manager/admin)
router.put('/:id/deny', requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    await query(
      `UPDATE pto_requests SET status='denied', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    const full = await query(REQUEST_SELECT + ` WHERE r.id = $1`, [req.params.id]);
    res.json(full.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/requests/:id  (admin only)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await query(`DELETE FROM pto_requests WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
