/**
 * Cron Jobs
 *
 * Schedules:
 *  - Daily job discovery (every 6 hours)
 *  - Auto-apply (every 2 hours for users who enabled it)
 *  - Follow-up emails (daily at 9 AM)
 *  - Daily alerts (configurable, default 8 AM)
 *  - Google Sheets sync (every 30 minutes)
 *  - Stale job cleanup (weekly)
 */

const cron = require('node-cron');
const { query } = require('../config/database');
const { runJobDiscovery } = require('../services/jobDiscovery/jobAggregator');
const { matchJobToCandidate } = require('../services/ai/jobMatcher');
const { runAutoApply } = require('../services/automation/applicationBot');
const { sendScheduledFollowUps, sendDailyAlert } = require('../services/email/emailService');
const { syncApplicationsToSheets } = require('../services/tracking/sheetsService');
const logger = require('../utils/logger');

function initCronJobs() {
  // ── Job Discovery every 6 hours ──────────────────────────────
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[CRON] Starting scheduled job discovery for all users');
    try {
      const usersResult = await query(
        `SELECT u.id, r.parsed_data, p.*
         FROM users u
         JOIN resumes r ON r.user_id = u.id AND r.is_active = true
         JOIN user_preferences p ON p.user_id = u.id`,
      );

      for (const user of usersResult.rows) {
        try {
          const jobs = await runJobDiscovery(user, user.parsed_data);

          // Match new jobs
          for (const job of jobs) {
            const match = matchJobToCandidate(job, user.parsed_data, user);
            await query(
              `INSERT INTO job_matches
                 (user_id, job_id, overall_score, skills_score, experience_score,
                  salary_score, location_score, visa_score, score_breakdown, matched_skills, missing_skills)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (user_id, job_id) DO NOTHING`,
              [
                user.id, job.id,
                match.overall_score, match.skills_score, match.experience_score,
                match.salary_score, match.location_score, match.visa_score,
                JSON.stringify(match.score_breakdown),
                match.matched_skills,
                match.missing_skills,
              ],
            ).catch(() => {});
          }
        } catch (err) {
          logger.error(`[CRON] Job discovery error for user ${user.id}:`, err.message);
        }
      }
    } catch (err) {
      logger.error('[CRON] Job discovery cron error:', err.message);
    }
  });

  // ── Auto-Apply every 2 hours ─────────────────────────────────
  cron.schedule('0 */2 * * *', async () => {
    logger.info('[CRON] Running scheduled auto-apply');
    try {
      const usersResult = await query(
        `SELECT user_id, daily_application_limit
         FROM user_preferences
         WHERE auto_apply_enabled = true`,
      );

      for (const user of usersResult.rows) {
        try {
          const stats = await runAutoApply(user.user_id, {
            dailyLimit: user.daily_application_limit || 10,
          });
          logger.info(`[CRON] Auto-apply for user ${user.user_id}: ${JSON.stringify(stats)}`);
        } catch (err) {
          logger.error(`[CRON] Auto-apply error for user ${user.user_id}:`, err.message);
        }
      }
    } catch (err) {
      logger.error('[CRON] Auto-apply cron error:', err.message);
    }
  });

  // ── Follow-up Emails daily at 9 AM ───────────────────────────
  cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Sending scheduled follow-up emails');
    try {
      const usersResult = await query('SELECT id FROM users');
      const days = parseInt(process.env.FOLLOW_UP_DAYS || '10', 10);

      for (const user of usersResult.rows) {
        await sendScheduledFollowUps(user.id, days).catch((err) => {
          logger.error(`[CRON] Follow-up error for user ${user.id}:`, err.message);
        });
      }
    } catch (err) {
      logger.error('[CRON] Follow-up cron error:', err.message);
    }
  });

  // ── Daily Alert emails (configurable hour, default 8 AM) ─────
  const alertHour = parseInt(process.env.ALERT_HOUR || '8', 10);
  cron.schedule(`0 ${alertHour} * * *`, async () => {
    logger.info('[CRON] Sending daily alert emails');
    try {
      const usersResult = await query(
        `SELECT u.id FROM users u
         JOIN user_preferences p ON p.user_id = u.id
         WHERE p.alert_email IS NOT NULL OR u.email IS NOT NULL`,
      );

      for (const user of usersResult.rows) {
        await sendDailyAlert(user.id).catch((err) => {
          logger.error(`[CRON] Daily alert error for user ${user.id}:`, err.message);
        });
      }
    } catch (err) {
      logger.error('[CRON] Daily alert cron error:', err.message);
    }
  });

  // ── Google Sheets sync every 30 minutes ──────────────────────
  cron.schedule('*/30 * * * *', async () => {
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) return;
    try {
      const usersResult = await query('SELECT id FROM users');
      for (const user of usersResult.rows) {
        await syncApplicationsToSheets(user.id).catch(() => {});
      }
    } catch (err) {
      logger.error('[CRON] Sheets sync error:', err.message);
    }
  });

  // ── Clean up old inactive jobs weekly ────────────────────────
  cron.schedule('0 2 * * 0', async () => {
    logger.info('[CRON] Cleaning up stale jobs');
    try {
      const result = await query(
        `UPDATE jobs SET is_active = false
         WHERE is_active = true
           AND posted_at < NOW() - INTERVAL '60 days'
           AND id NOT IN (SELECT DISTINCT job_id FROM applications)`,
      );
      logger.info(`[CRON] Deactivated ${result.rowCount} stale jobs`);
    } catch (err) {
      logger.error('[CRON] Job cleanup error:', err.message);
    }
  });

  logger.info('All cron jobs scheduled');
}

module.exports = { initCronJobs };
