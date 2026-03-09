const { query } = require('../config/database');
const { generateColdOutreachEmail, generateFollowUpEmail, findRecruiterEmailHint } = require('../services/ai/emailGenerator');
const { sendEmail, sendScheduledFollowUps } = require('../services/email/emailService');
const { success, error } = require('../utils/helpers');

async function generateAndSendOutreach(req, res, next) {
  try {
    const userId = req.user.id;
    const { job_id, recruiter } = req.body;

    const [resumeRes, jobRes] = await Promise.all([
      query('SELECT parsed_data FROM resumes WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]),
      query('SELECT * FROM jobs WHERE id = $1', [job_id]),
    ]);

    if (!resumeRes.rows.length) return error(res, 'No active resume', 400);
    if (!jobRes.rows.length) return error(res, 'Job not found', 404);

    const candidate = resumeRes.rows[0].parsed_data;
    const job = jobRes.rows[0];

    const { subject, body } = await generateColdOutreachEmail({ candidate, recruiter, job });

    if (recruiter?.email) {
      const result = await sendEmail({
        userId,
        applicationId: req.body.application_id || null,
        to: recruiter.email,
        toName: recruiter.name,
        subject,
        body,
        type: 'cold_outreach',
      });

      return success(res, { subject, body, email_id: result.emailId, status: result.status });
    }

    return success(res, { subject, body, note: 'Email generated but not sent — no recruiter email provided' });
  } catch (err) {
    next(err);
  }
}

async function findRecruiter(req, res, next) {
  try {
    const { company, role } = req.query;
    if (!company) return error(res, 'company is required', 400);

    const hint = await findRecruiterEmailHint(company, role || 'Engineer');
    return success(res, hint);
  } catch (err) {
    next(err);
  }
}

async function getEmails(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const type = req.query.type;

    const params = [userId];
    let where = 'WHERE e.user_id = $1';
    if (type) { params.push(type); where += ` AND e.type = $${params.length}`; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT e.*, j.company, j.role
         FROM emails e
         LEFT JOIN applications a ON a.id = e.application_id
         LEFT JOIN jobs j ON j.id = a.job_id
         ${where} ORDER BY e.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (parseInt(req.query.page || 1, 10) - 1) * limit],
      ),
      query(`SELECT COUNT(*) FROM emails e ${where}`, params),
    ]);

    return success(res, {
      emails: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

async function sendFollowUps(req, res, next) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days || process.env.FOLLOW_UP_DAYS || '10', 10);
    const sent = await sendScheduledFollowUps(userId, days);
    return success(res, { sent: sent.length, emails: sent });
  } catch (err) {
    next(err);
  }
}

async function getEmailStats(req, res, next) {
  try {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
         COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied,
         COUNT(CASE WHEN type = 'cold_outreach' THEN 1 END) as outreach,
         COUNT(CASE WHEN type = 'follow_up' THEN 1 END) as follow_ups
       FROM emails WHERE user_id = $1`,
      [req.user.id],
    );
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateAndSendOutreach,
  findRecruiter,
  getEmails,
  sendFollowUps,
  getEmailStats,
};
