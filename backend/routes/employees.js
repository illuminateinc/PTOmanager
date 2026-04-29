const { Router } = require('express');
const { query } = require('../db/pool');
const { requireRole } = require('../middleware/rbac');

const router = Router();

const CURRENT_YEAR = () => new Date().getFullYear();

// Build the SELECT that returns the nested balance shape the frontend expects
const EMPLOYEE_SELECT = `
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.department,
    TO_CHAR(u.hire_date, 'YYYY-MM-DD')   AS "startDate",
    u.accrual_rate::float                 AS "accrualRate",
    u.manager_id                          AS "managerId",
    u.cognito_sub                         AS "cognitoSub",
    json_build_object(
      'total', COALESCE((SELECT total_days::float FROM pto_balances WHERE user_id = u.id AND bucket = 'vacation'     AND year = $1), 0)
    ) AS vacation,
    json_build_object(
      'total', COALESCE((SELECT total_days::float FROM pto_balances WHERE user_id = u.id AND bucket = 'sick'         AND year = $1), 0)
    ) AS sick,
    json_build_object(
      'total', COALESCE((SELECT total_days::float FROM pto_balances WHERE user_id = u.id AND bucket = 'personal'     AND year = $1), 0)
    ) AS personal,
    json_build_object(
      'total', COALESCE((SELECT total_days::float FROM pto_balances WHERE user_id = u.id AND bucket = 'floatHoliday' AND year = $1), 0)
    ) AS "floatHoliday"
  FROM users u
`;

// GET /api/employees
router.get('/', async (req, res, next) => {
  try {
    const year = CURRENT_YEAR();
    let sql = EMPLOYEE_SELECT;
    const params = [year];

    if (req.user.role === 'employee') {
      sql += ` WHERE u.cognito_sub = $2 OR u.email = $2`;
      params.push(req.user.cognitoSub || req.user.email);
    } else if (req.user.role === 'manager') {
      // Manager sees themselves + direct reports
      sql += ` WHERE u.cognito_sub = $2 OR u.email = $2 OR u.manager_id = (SELECT id FROM users WHERE cognito_sub = $2 OR email = $2 LIMIT 1)`;
      params.push(req.user.cognitoSub || req.user.email);
    }
    // admin: no filter

    sql += ` ORDER BY u.name`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/employees/:id
router.get('/:id', async (req, res, next) => {
  try {
    const year = CURRENT_YEAR();
    const result = await query(EMPLOYEE_SELECT + ` WHERE u.id = $2`, [year, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/employees  (admin only)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, role, department, startDate, accrualRate, vacation, sick, personal, floatHoliday } = req.body;
    const year = CURRENT_YEAR();

    const inserted = await query(
      `INSERT INTO users (name, email, role, department, hire_date, accrual_rate)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, email, role?.toLowerCase() || 'employee', department, startDate || null, accrualRate || 3.33]
    );
    const userId = inserted.rows[0].id;

    const balances = [
      ['vacation',     vacation?.total     ?? 0],
      ['sick',         sick?.total         ?? 5],
      ['personal',     personal?.total     ?? 2],
      ['floatHoliday', floatHoliday?.total ?? 1],
    ];
    for (const [bucket, total] of balances) {
      await query(
        `INSERT INTO pto_balances (user_id, bucket, total_days, year) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, bucket, year) DO UPDATE SET total_days = $3`,
        [userId, bucket, total, year]
      );
    }

    const result = await query(EMPLOYEE_SELECT + ` WHERE u.id = $2`, [year, userId]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/employees/:id  (admin only)
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, role, department, startDate, accrualRate, managerId } = req.body;
    await query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4, hire_date=$5, accrual_rate=$6, manager_id=$7
       WHERE id=$8`,
      [name, email, role?.toLowerCase(), department, startDate || null, accrualRate, managerId || null, req.params.id]
    );
    const year = CURRENT_YEAR();
    const result = await query(EMPLOYEE_SELECT + ` WHERE u.id = $2`, [year, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/employees/:id/cognito — called after user signs in to link Cognito sub
router.patch('/:id/cognito', async (req, res, next) => {
  try {
    await query(`UPDATE users SET cognito_sub = $1 WHERE id = $2`, [req.user.cognitoSub, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
