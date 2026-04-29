const { Router } = require('express');
const { query } = require('../db/pool');

const router = Router();

// GET /api/balances/:userId
router.get('/:userId', async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const result = await query(
      `SELECT bucket, total_days::float AS "totalDays", year
       FROM pto_balances
       WHERE user_id = $1 AND year = $2`,
      [req.params.userId, year]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// PUT /api/balances/:userId — update a specific bucket total (admin only)
router.put('/:userId', async (req, res, next) => {
  try {
    const { bucket, totalDays, year } = req.body;
    const y = year || new Date().getFullYear();
    await query(
      `INSERT INTO pto_balances (user_id, bucket, total_days, year) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, bucket, year) DO UPDATE SET total_days = $3`,
      [req.params.userId, bucket, totalDays, y]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
