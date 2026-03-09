const { query, transaction } = require('../config/database');
const { runAutoApply } = require('../services/automation/applicationBot');
const { syncApplicationsToSheets } = require('../services/tracking/sheetsService');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

async function getApplications(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const status = req.query.status;

    const conditions = ['a.user_id = $1'];
    const params = [userId];

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT
           a.*,
           j.company, j.role, j.location, j.work_mode, j.application_url,
           j.salary_min, j.salary_max, j.source,
           jm.overall_score
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN job_matches jm ON jm.id = a.match_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      query(`SELECT COUNT(*) FROM applications a ${where}`, params),
    ]);

    return success(res, {
      applications: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count, 10) / limit),
    });
  } catch (err) {
    next(err);
  }
}

async function createApplication(req, res, next) {
  try {
    const userId = req.user.id;
    const { job_id, cover_letter, notes } = req.body;

    // Verify job exists
    const jobRes = await query('SELECT id FROM jobs WHERE id = $1', [job_id]);
    if (!jobRes.rows.length) return error(res, 'Job not found', 404);

    const matchRes = await query(
      'SELECT id FROM job_matches WHERE user_id = $1 AND job_id = $2',
      [userId, job_id],
    );

    const result = await query(
      `INSERT INTO applications (user_id, job_id, match_id, status, cover_letter, notes, applied_at)
       VALUES ($1,$2,$3,'applied',$4,$5,NOW())
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         status = 'applied', applied_at = NOW(), cover_letter = EXCLUDED.cover_letter
       RETURNING *`,
      [userId, job_id, matchRes.rows[0]?.id || null, cover_letter, notes],
    );

    await query(
      `INSERT INTO activity_log (user_id, type, description)
       VALUES ($1, 'manual_apply', $2)`,
      [userId, `Manual application created for job ${job_id}`],
    );

    // Sync to Sheets in background
    syncApplicationsToSheets(userId).catch((e) => logger.warn('Sheets sync error:', e.message));

    return success(res, result.rows[0], 201);
  } catch (err) {
    next(err);
  }
}

async function updateApplicationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status, notes, interview_at } = req.body;

    const validStatuses = [
      'pending', 'applied', 'interview_scheduled', 'interviewed',
      'offer_received', 'rejected', 'withdrawn', 'follow_up_sent',
    ];

    if (!validStatuses.includes(status)) {
      return error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const updateFields = ['status = $3', 'updated_at = NOW()'];
    const params = [userId, id, status];

    if (notes !== undefined) {
      params.push(notes);
      updateFields.push(`notes = $${params.length}`);
    }

    if (interview_at) {
      params.push(interview_at);
      updateFields.push(`interview_at = $${params.length}`);
    }

    if (status === 'applied') {
      params.push(new Date());
      updateFields.push(`applied_at = COALESCE(applied_at, $${params.length})`);
    }

    if (status === 'rejected') updateFields.push('rejected_at = NOW()');
    if (status === 'offer_received') updateFields.push('offer_at = NOW()');

    const result = await query(
      `UPDATE applications SET ${updateFields.join(', ')}
       WHERE user_id = $1 AND id = $2 RETURNING *`,
      params,
    );

    if (!result.rows.length) return error(res, 'Application not found', 404);

    await query(
      `INSERT INTO activity_log (user_id, type, description)
       VALUES ($1, 'status_update', $2)`,
      [userId, `Application ${id} status → ${status}`],
    );

    // Sync Sheets
    syncApplicationsToSheets(userId).catch(() => {});

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function triggerAutoApply(req, res, next) {
  try {
    const userId = req.user.id;

    // Check preferences
    const prefRes = await query(
      'SELECT auto_apply_enabled, daily_application_limit FROM user_preferences WHERE user_id = $1',
      [userId],
    );

    const prefs = prefRes.rows[0];
    const dailyLimit = parseInt(req.body.daily_limit || prefs?.daily_application_limit || 10, 10);

    const stats = await runAutoApply(userId, { dailyLimit });

    return success(res, { message: 'Auto-apply run complete', stats });
  } catch (err) {
    next(err);
  }
}

async function getApplicationStats(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
         COUNT(CASE WHEN status = 'interview_scheduled' THEN 1 END) as interviews,
         COUNT(CASE WHEN status = 'offer_received' THEN 1 END) as offers,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
         COUNT(CASE WHEN status = 'follow_up_sent' THEN 1 END) as follow_ups,
         COUNT(CASE WHEN auto_applied = true THEN 1 END) as auto_applied,
         COUNT(CASE WHEN applied_at >= CURRENT_DATE THEN 1 END) as applied_today
       FROM applications WHERE user_id = $1`,
      [userId],
    );

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function syncToSheets(req, res, next) {
  try {
    const result = await syncApplicationsToSheets(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getApplications,
  createApplication,
  updateApplicationStatus,
  triggerAutoApply,
  getApplicationStats,
  syncToSheets,
};
