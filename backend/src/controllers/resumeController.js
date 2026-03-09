const { query } = require('../config/database');
const { processResume, tailorResumeForJob } = require('../services/ai/resumeAnalyzer');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

async function uploadResume(req, res, next) {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);

    const userId = req.user.id;
    const { path: filePath, originalname, size, mimetype } = req.file;

    // Mark old resumes inactive
    await query('UPDATE resumes SET is_active = false WHERE user_id = $1', [userId]);

    const { rawText, parsedData, improvementTips } = await processResume(filePath);

    const result = await query(
      `INSERT INTO resumes
         (user_id, file_name, file_path, file_size, mime_type, raw_text, parsed_data, improvement_tips)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        userId,
        originalname,
        filePath,
        size,
        mimetype,
        rawText,
        JSON.stringify(parsedData),
        JSON.stringify(improvementTips),
      ],
    );

    // Update preferences with parsed data
    if (parsedData) {
      await query(
        `UPDATE user_preferences SET
           target_roles = CASE WHEN array_length(target_roles, 1) IS NULL THEN $2 ELSE target_roles END,
           preferred_locations = CASE WHEN array_length(preferred_locations, 1) IS NULL THEN $3 ELSE preferred_locations END,
           years_experience = COALESCE(years_experience, $4),
           min_salary = COALESCE(min_salary, $5),
           max_salary = COALESCE(max_salary, $6)
         WHERE user_id = $1`,
        [
          userId,
          parsedData.preferred_roles || [],
          parsedData.preferred_locations || [],
          parsedData.years_of_experience,
          parsedData.salary_expectation_min,
          parsedData.salary_expectation_max,
        ],
      );
    }

    await query(
      `INSERT INTO activity_log (user_id, type, description)
       VALUES ($1, 'resume_upload', $2)`,
      [userId, `Uploaded resume: ${originalname}`],
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    next(err);
  }
}

async function getResume(req, res, next) {
  try {
    const result = await query(
      'SELECT * FROM resumes WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [req.user.id],
    );

    if (!result.rows.length) return error(res, 'No active resume found', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getImprovementTips(req, res, next) {
  try {
    const result = await query(
      'SELECT improvement_tips FROM resumes WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user.id],
    );

    if (!result.rows.length) return error(res, 'No active resume found', 404);
    return success(res, result.rows[0].improvement_tips);
  } catch (err) {
    next(err);
  }
}

async function tailorResume(req, res, next) {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    const [resumeResult, jobResult] = await Promise.all([
      query('SELECT * FROM resumes WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]),
      query('SELECT * FROM jobs WHERE id = $1', [jobId]),
    ]);

    if (!resumeResult.rows.length) return error(res, 'No active resume', 404);
    if (!jobResult.rows.length) return error(res, 'Job not found', 404);

    const resume = resumeResult.rows[0];
    const job = jobResult.rows[0];

    const tailored = await tailorResumeForJob(resume.raw_text, job.description, job.role, job.company);

    // Save to match
    await query(
      `UPDATE job_matches SET tailored_resume = $1 WHERE user_id = $2 AND job_id = $3`,
      [tailored, userId, jobId],
    );

    return success(res, { tailored_resume: tailored });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadResume, getResume, getImprovementTips, tailorResume };
