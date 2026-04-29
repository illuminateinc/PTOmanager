const { Router } = require('express');
const { query } = require('../db/pool');
const { requireRole } = require('../middleware/rbac');

const router = Router();

// POST /api/bonus — award bonus vacation days (admin or manager to their reports)
router.post('/', requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { userId, days, reason } = req.body;
    if (!userId || !days || days <= 0) {
      return res.status(400).json({ error: 'userId and positive days are required' });
    }

    const awarder = await query(
      `SELECT id FROM users WHERE cognito_sub=$1 OR email=$1 LIMIT 1`,
      [req.user.cognitoSub || req.user.email]
    );
    const awardedBy = awarder.rows[0]?.id || null;

    // Managers can only award to their direct reports
    if (req.user.role === 'manager') {
      const check = await query(
        `SELECT id FROM users WHERE id=$1 AND manager_id=$2`,
        [userId, awardedBy]
      );
      if (!check.rows.length) {
        return res.status(403).json({ error: 'Can only award bonus days to your direct reports' });
      }
    }

    const year = new Date().getFullYear();

    // Log the bonus
    await query(
      `INSERT INTO bonus_days (user_id, days, reason, awarded_by) VALUES ($1, $2, $3, $4)`,
      [userId, days, reason || '', awardedBy]
    );

    // Increase the vacation total in pto_balances
    await query(
      `INSERT INTO pto_balances (user_id, bucket, total_days, year) VALUES ($1, 'vacation', $2, $3)
       ON CONFLICT (user_id, bucket, year) DO UPDATE SET total_days = pto_balances.total_days + $2`,
      [userId, days, year]
    );

    const updated = await query(
      `SELECT total_days::float AS "totalDays" FROM pto_balances WHERE user_id=$1 AND bucket='vacation' AND year=$2`,
      [userId, year]
    );

    res.json({ ok: true, newTotal: updated.rows[0]?.totalDays });
  } catch (err) { next(err); }
});

module.exports = router;
