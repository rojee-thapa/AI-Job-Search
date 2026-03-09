const { query } = require('../config/database');
const { runJobDiscovery, fetchMatchedJobs } = require('../services/jobDiscovery/jobAggregator');
const { matchJobToCandidate, rankJobs } = require('../services/ai/jobMatcher');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

async function discoverJobs(req, res, next) {
  try {
    const userId = req.user.id;

    const [prefResult, resumeResult] = await Promise.all([
      query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]),
      query('SELECT * FROM resumes WHERE user_id = $1 AND is_active = true LIMIT 1', [userId]),
    ]);

    if (!resumeResult.rows.length) return error(res, 'Upload a resume first', 400);

    const preferences = prefResult.rows[0] || {};
    const parsedResume = resumeResult.rows[0].parsed_data;

    // Run discovery in background, respond immediately
    res.json({ success: true, data: { message: 'Job discovery started. Check back shortly.' } });

    // Async discovery
    setImmediate(async () => {
      try {
        const jobs = await runJobDiscovery(preferences, parsedResume);

        // Match all discovered jobs
        for (const job of jobs) {
          try {
            const match = matchJobToCandidate(job, parsedResume, preferences);
            await query(
              `INSERT INTO job_matches
                 (user_id, job_id, resume_id, overall_score, skills_score, experience_score,
                  salary_score, location_score, visa_score, score_breakdown, matched_skills, missing_skills)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               ON CONFLICT (user_id, job_id) DO UPDATE SET
                 overall_score = EXCLUDED.overall_score,
                 skills_score = EXCLUDED.skills_score,
                 experience_score = EXCLUDED.experience_score`,
              [
                userId, job.id, resumeResult.rows[0].id,
                match.overall_score, match.skills_score, match.experience_score,
                match.salary_score, match.location_score, match.visa_score,
                JSON.stringify(match.score_breakdown),
                match.matched_skills,
                match.missing_skills,
              ],
            );
          } catch (matchErr) {
            logger.error('Match insert error:', matchErr.message);
          }
        }

        await query(
          `INSERT INTO activity_log (user_id, type, description, metadata)
           VALUES ($1, 'job_discovery', $2, $3)`,
          [userId, `Discovered ${jobs.length} jobs`, JSON.stringify({ count: jobs.length })],
        );
      } catch (err) {
        logger.error('Background job discovery error:', err.message);
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getMatchedJobs(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const minScore = parseFloat(req.query.min_score || '0');
    const status = req.query.status || null;
    const source = req.query.source || null;
    const workMode = req.query.work_mode || null;

    let queryText = `
      SELECT
        j.*,
        jm.overall_score, jm.skills_score, jm.experience_score,
        jm.salary_score, jm.location_score, jm.visa_score,
        jm.matched_skills, jm.missing_skills, jm.is_saved, jm.id AS match_id,
        a.status AS application_status, a.id AS application_id, a.applied_at
      FROM job_matches jm
      JOIN jobs j ON j.id = jm.job_id
      LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1
      WHERE jm.user_id = $1
        AND jm.is_hidden = false
        AND jm.overall_score >= $2
    `;

    const params = [userId, minScore];

    if (source) {
      params.push(source);
      queryText += ` AND j.source = $${params.length}`;
    }

    if (workMode) {
      params.push(workMode);
      queryText += ` AND j.work_mode = $${params.length}`;
    }

    const countQuery = queryText.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) FROM');
    const [dataRes, countRes] = await Promise.all([
      query(queryText + ` ORDER BY jm.overall_score DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]),
      query(countQuery, params),
    ]);

    return success(res, {
      jobs: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count, 10) / limit),
    });
  } catch (err) {
    next(err);
  }
}

async function getJobById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT j.*,
         jm.overall_score, jm.skills_score, jm.experience_score,
         jm.salary_score, jm.location_score, jm.visa_score,
         jm.matched_skills, jm.missing_skills, jm.score_breakdown, jm.is_saved,
         a.status AS application_status, a.id AS application_id
       FROM jobs j
       LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.user_id = $2
       LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $2
       WHERE j.id = $1`,
      [id, userId],
    );

    if (!result.rows.length) return error(res, 'Job not found', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function hideJob(req, res, next) {
  try {
    await query(
      'UPDATE job_matches SET is_hidden = true WHERE user_id = $1 AND job_id = $2',
      [req.user.id, req.params.id],
    );
    return success(res, { hidden: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle the saved state of a job match.
 * POST body: { save: true|false }  (default: true)
 */
async function saveJob(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const save = req.body.save !== false; // default true

    const result = await query(
      `UPDATE job_matches SET is_saved = $1
       WHERE user_id = $2 AND job_id = $3
       RETURNING is_saved`,
      [save, userId, id],
    );

    if (!result.rows.length) return error(res, 'Job match not found', 404);
    return success(res, { saved: result.rows[0].is_saved });
  } catch (err) {
    next(err);
  }
}

/**
 * Return all jobs the user has saved, with match scores.
 */
async function getSavedJobs(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT
           j.*,
           jm.overall_score, jm.skills_score, jm.experience_score,
           jm.salary_score, jm.location_score, jm.visa_score,
           jm.matched_skills, jm.missing_skills, jm.is_saved, jm.id AS match_id,
           a.status AS application_status, a.id AS application_id, a.applied_at
         FROM job_matches jm
         JOIN jobs j ON j.id = jm.job_id
         LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1
         WHERE jm.user_id = $1 AND jm.is_saved = true AND jm.is_hidden = false
         ORDER BY jm.overall_score DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, (page - 1) * limit],
      ),
      query(
        'SELECT COUNT(*) FROM job_matches WHERE user_id = $1 AND is_saved = true AND is_hidden = false',
        [userId],
      ),
    ]);

    return success(res, {
      jobs: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count, 10) / limit),
    });
  } catch (err) {
    next(err);
  }
}

async function getJobStats(req, res, next) {
  try {
    const userId = req.user.id;

    const [totalRes, sourceRes, scoreRes] = await Promise.all([
      query('SELECT COUNT(*) FROM job_matches WHERE user_id = $1', [userId]),
      query(
        `SELECT j.source, COUNT(*) as count
         FROM job_matches jm JOIN jobs j ON j.id = jm.job_id
         WHERE jm.user_id = $1
         GROUP BY j.source ORDER BY count DESC`,
        [userId],
      ),
      query(
        `SELECT
           ROUND(AVG(overall_score), 1) as avg_score,
           MAX(overall_score) as max_score,
           COUNT(CASE WHEN overall_score >= 80 THEN 1 END) as high_match_count
         FROM job_matches WHERE user_id = $1`,
        [userId],
      ),
    ]);

    return success(res, {
      total: parseInt(totalRes.rows[0].count, 10),
      by_source: sourceRes.rows,
      scores: scoreRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { discoverJobs, getMatchedJobs, getJobById, hideJob, saveJob, getSavedJobs, getJobStats };
