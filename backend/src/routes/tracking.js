const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { success } = require('../utils/helpers');

const router = Router();

router.use(authenticate);

router.get('/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const result = await query(
      `SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit],
    );
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [appStats, jobStats, emailStats, recentActivity, upcomingInterviews] = await Promise.all([
      query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
           COUNT(CASE WHEN status IN ('interview_scheduled','interviewed') THEN 1 END) as interviews,
           COUNT(CASE WHEN status = 'offer_received' THEN 1 END) as offers,
           COUNT(CASE WHEN applied_at >= CURRENT_DATE THEN 1 END) as applied_today
         FROM applications WHERE user_id = $1`,
        [userId],
      ),
      query(
        `SELECT COUNT(*) as total, ROUND(AVG(overall_score), 1) as avg_score
         FROM job_matches WHERE user_id = $1`,
        [userId],
      ),
      query(
        `SELECT COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened
         FROM emails WHERE user_id = $1`,
        [userId],
      ),
      query(
        `SELECT type, description, created_at FROM activity_log
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [userId],
      ),
      query(
        `SELECT j.company, j.role, a.interview_at, a.id AS application_id
         FROM applications a JOIN jobs j ON j.id = a.job_id
         WHERE a.user_id = $1
           AND a.interview_at >= NOW()
           AND a.interview_at <= NOW() + INTERVAL '14 days'
         ORDER BY a.interview_at ASC`,
        [userId],
      ),
    ]);

    return success(res, {
      applications: appStats.rows[0],
      jobs: jobStats.rows[0],
      emails: emailStats.rows[0],
      recent_activity: recentActivity.rows,
      upcoming_interviews: upcomingInterviews.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
