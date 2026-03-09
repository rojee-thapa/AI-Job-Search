const { query } = require('../config/database');
const { generateInterviewQuestions, evaluatePracticeAnswer, generateCompanyBrief } = require('../services/ai/interviewPrep');
const { success, error } = require('../utils/helpers');

async function createInterviewSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { job_id, application_id } = req.body;

    const [resumeRes, jobRes] = await Promise.all([
      query('SELECT parsed_data FROM resumes WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]),
      query('SELECT * FROM jobs WHERE id = $1', [job_id]),
    ]);

    if (!resumeRes.rows.length) return error(res, 'Upload a resume first', 400);
    if (!jobRes.rows.length) return error(res, 'Job not found', 404);

    const parsedResume = resumeRes.rows[0].parsed_data;
    const job = jobRes.rows[0];

    const [questions, companyBrief] = await Promise.all([
      generateInterviewQuestions({ job, parsedResume }),
      generateCompanyBrief(job.company, job.role),
    ]);

    const result = await query(
      `INSERT INTO interview_sessions
         (user_id, job_id, application_id, company, role, questions)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        userId, job_id, application_id || null,
        job.company, job.role,
        JSON.stringify({ ...questions, company_brief: companyBrief }),
      ],
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    next(err);
  }
}

async function getInterviewSession(req, res, next) {
  try {
    const result = await query(
      `SELECT sess.*, sess.job_id, j.description as job_description, j.application_url
       FROM interview_sessions sess
       JOIN jobs j ON j.id = sess.job_id
       WHERE sess.id = $1 AND sess.user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (!result.rows.length) return error(res, 'Session not found', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listInterviewSessions(req, res, next) {
  try {
    const result = await query(
      `SELECT sess.id, sess.job_id, sess.company, sess.role, sess.scheduled_at, sess.created_at,
         a.status as application_status
       FROM interview_sessions sess
       LEFT JOIN applications a ON a.id = sess.application_id
       WHERE sess.user_id = $1
       ORDER BY sess.created_at DESC`,
      [req.user.id],
    );
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
}

async function evaluateAnswer(req, res, next) {
  try {
    const { question, answer, job_id } = req.body;

    const jobRes = await query('SELECT company, role FROM jobs WHERE id = $1', [job_id]);
    const jobContext = jobRes.rows[0] || { company: 'Unknown', role: 'Unknown' };

    const feedback = await evaluatePracticeAnswer({ question, answer, jobContext });
    return success(res, feedback);
  } catch (err) {
    next(err);
  }
}

async function scheduleInterview(req, res, next) {
  try {
    const { application_id, scheduled_at, notes } = req.body;

    const appRes = await query(
      `UPDATE applications
       SET status = 'interview_scheduled', interview_at = $2, notes = COALESCE($3, notes)
       WHERE id = $1 AND user_id = $4
       RETURNING *`,
      [application_id, scheduled_at, notes, req.user.id],
    );

    if (!appRes.rows.length) return error(res, 'Application not found', 404);

    await query(
      `INSERT INTO activity_log (user_id, type, description)
       VALUES ($1, 'interview_scheduled', $2)`,
      [req.user.id, `Interview scheduled for ${new Date(scheduled_at).toLocaleDateString()}`],
    );

    return success(res, appRes.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createInterviewSession,
  getInterviewSession,
  listInterviewSessions,
  evaluateAnswer,
  scheduleInterview,
};
