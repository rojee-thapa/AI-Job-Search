/**
 * Application Automation Bot (Playwright)
 *
 * Automatically fills out and submits job applications.
 * Supports Greenhouse, Lever, Workday, and generic forms.
 * Includes duplicate detection, daily limit enforcement, and audit logging.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { query, transaction } = require('../../config/database');
const { generateCoverLetter } = require('../ai/resumeAnalyzer');
const { sleep } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const HEADLESS = process.env.SCRAPER_HEADLESS !== 'false';
const DELAY = parseInt(process.env.APPLICATION_DELAY_MS || '5000', 10);

// ─── ATS Platform Detectors ──────────────────────────────────

function detectPlatform(url) {
  if (!url) return 'generic';
  if (url.includes('greenhouse.io') || url.includes('boards.greenhouse')) return 'greenhouse';
  if (url.includes('lever.co') || url.includes('jobs.lever')) return 'lever';
  if (url.includes('workday.com') || url.includes('myworkdayjobs')) return 'workday';
  if (url.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (url.includes('ashbyhq.com')) return 'ashby';
  return 'generic';
}

// ─── Platform-Specific Fillers ───────────────────────────────

async function fillGreenhouseForm(page, candidate, resumePath, coverLetter) {
  const log = [];

  // First name / Last name
  await page.fill('#first_name', candidate.full_name?.split(' ')[0] || '').catch(() => {});
  await page.fill('#last_name', candidate.full_name?.split(' ').slice(1).join(' ') || '').catch(() => {});
  await page.fill('#email', candidate.email || '').catch(() => {});
  await page.fill('#phone', candidate.phone || '').catch(() => {});

  // Resume upload
  const resumeInput = page.locator('input[type="file"][name*="resume"], input[type="file"][id*="resume"]');
  if (await resumeInput.count()) {
    await resumeInput.setInputFiles(resumePath);
    log.push('Resume uploaded');
  }

  // Cover letter textarea
  const coverLetterArea = page.locator('textarea[name*="cover"], textarea[id*="cover"]');
  if (await coverLetterArea.count()) {
    await coverLetterArea.fill(coverLetter);
    log.push('Cover letter filled');
  }

  // LinkedIn URL
  const linkedInInput = page.locator('input[id*="linkedin"], input[name*="linkedin"]');
  if (await linkedInInput.count() && candidate.linkedin) {
    await linkedInInput.fill(candidate.linkedin);
  }

  // Submit
  const submitBtn = page.locator('input[type="submit"], button[type="submit"]').first();
  if (await submitBtn.count()) {
    await submitBtn.click();
    log.push('Form submitted');
  }

  return log;
}

async function fillLeverForm(page, candidate, resumePath, coverLetter) {
  const log = [];

  await page.fill('input[name="name"]', candidate.full_name || '').catch(() => {});
  await page.fill('input[name="email"]', candidate.email || '').catch(() => {});
  await page.fill('input[name="phone"]', candidate.phone || '').catch(() => {});

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(resumePath);
    log.push('Resume uploaded');
  }

  const coverArea = page.locator('textarea[name*="comment"], textarea[name*="cover"]');
  if (await coverArea.count()) {
    await coverArea.fill(coverLetter);
    log.push('Cover letter filled');
  }

  const submitBtn = page.locator('button[type="submit"], input[type="submit"]').last();
  if (await submitBtn.count()) {
    await submitBtn.click();
    log.push('Form submitted');
  }

  return log;
}

async function fillGenericForm(page, candidate, resumePath, coverLetter) {
  const log = [];

  // Name fields
  const nameSelectors = ['input[name*="name"][name*="first"]', 'input[id*="first"]', 'input[placeholder*="First name" i]'];
  for (const sel of nameSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.fill(candidate.full_name?.split(' ')[0] || '');
      break;
    }
  }

  const lastNameSelectors = ['input[name*="last"]', 'input[id*="last"]', 'input[placeholder*="Last name" i]'];
  for (const sel of lastNameSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.fill(candidate.full_name?.split(' ').slice(1).join(' ') || '');
      break;
    }
  }

  // Email
  const emailEl = page.locator('input[type="email"], input[name*="email"]').first();
  if (await emailEl.count()) {
    await emailEl.fill(candidate.email || '');
    log.push('Email filled');
  }

  // Phone
  const phoneEl = page.locator('input[type="tel"], input[name*="phone"]').first();
  if (await phoneEl.count()) {
    await phoneEl.fill(candidate.phone || '');
  }

  // File upload
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(resumePath);
    log.push('Resume uploaded');
  }

  // Cover letter / message textarea
  const textareas = page.locator('textarea');
  const count = await textareas.count();
  if (count > 0) {
    await textareas.last().fill(coverLetter);
    log.push('Cover letter filled');
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Apply"), button:has-text("Submit")').last();
  if (await submitBtn.count()) {
    await submitBtn.click();
    log.push('Form submitted');
  }

  return log;
}

// ─── Main Application Function ───────────────────────────────

async function applyToJob({ applicationId, job, candidate, parsedResume, resumePath }) {
  const botLog = { platform: null, steps: [], error: null, success: false };

  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: false,
  });

  const page = await context.newPage();

  try {
    const platform = detectPlatform(job.application_url);
    botLog.platform = platform;
    botLog.steps.push(`Detected platform: ${platform}`);

    // Generate tailored cover letter
    const coverLetter = await generateCoverLetter(parsedResume, job);
    botLog.steps.push('Cover letter generated');

    // Navigate to application page
    await page.goto(job.application_url, { waitUntil: 'networkidle', timeout: 30000 });
    botLog.steps.push(`Navigated to: ${job.application_url}`);
    await sleep(2000);

    // Take screenshot before filling
    const screenshotPath = path.join(process.cwd(), 'uploads', candidate.id, `bot_${applicationId}_before.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

    let fillLog = [];

    if (platform === 'greenhouse') {
      fillLog = await fillGreenhouseForm(page, candidate, resumePath, coverLetter);
    } else if (platform === 'lever') {
      fillLog = await fillLeverForm(page, candidate, resumePath, coverLetter);
    } else {
      fillLog = await fillGenericForm(page, candidate, resumePath, coverLetter);
    }

    botLog.steps.push(...fillLog);
    await sleep(2000);

    // Wait for success indication
    const successIndicators = [
      'text=application submitted',
      'text=thank you for applying',
      'text=we\'ll be in touch',
      'text=application received',
      '.confirmation',
      '[data-testid="confirmation"]',
    ];

    let confirmed = false;
    for (const indicator of successIndicators) {
      if (await page.locator(indicator).count()) {
        confirmed = true;
        break;
      }
    }

    botLog.success = confirmed || fillLog.includes('Form submitted');
    botLog.steps.push(confirmed ? 'Success confirmed on page' : 'Submission attempted');
    botLog.cover_letter = coverLetter;

    logger.info(`Application bot: ${botLog.success ? 'SUCCESS' : 'ATTEMPTED'} for ${job.company} — ${job.role}`);
  } catch (err) {
    botLog.error = err.message;
    botLog.steps.push(`Error: ${err.message}`);
    logger.error(`Application bot error for ${job.company}:`, err.message);
  } finally {
    await browser.close();
  }

  return botLog;
}

// ─── Batch Auto-Apply ────────────────────────────────────────

async function runAutoApply(userId, { dailyLimit = 10 } = {}) {
  // Check today's application count
  const todayCount = await query(
    `SELECT COUNT(*) FROM applications
     WHERE user_id = $1 AND auto_applied = true AND applied_at >= CURRENT_DATE`,
    [userId],
  );

  const appliedToday = parseInt(todayCount.rows[0].count, 10);
  const remaining = dailyLimit - appliedToday;

  if (remaining <= 0) {
    logger.info(`Auto-apply: daily limit (${dailyLimit}) reached for user ${userId}`);
    return { applied: 0, skipped: 0, errors: 0 };
  }

  // Get top pending matches above threshold, not yet applied
  const pendingResult = await query(
    `SELECT
       jm.id AS match_id,
       jm.job_id,
       jm.overall_score,
       jm.tailored_resume,
       jm.tailored_cover_letter,
       j.*
     FROM job_matches jm
     JOIN jobs j ON j.id = jm.job_id
     LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1
     WHERE jm.user_id = $1
       AND a.id IS NULL
       AND jm.overall_score >= (SELECT COALESCE(min_match_score, 70) FROM user_preferences WHERE user_id = $1)
       AND j.application_url IS NOT NULL
       AND j.is_active = true
     ORDER BY jm.overall_score DESC
     LIMIT $2`,
    [userId, remaining],
  );

  if (!pendingResult.rows.length) {
    logger.info(`Auto-apply: no pending matches for user ${userId}`);
    return { applied: 0, skipped: 0, errors: 0 };
  }

  // Get user + resume data
  const userResult = await query(
    `SELECT u.*, r.file_path, r.parsed_data, r.raw_text
     FROM users u
     JOIN resumes r ON r.user_id = u.id AND r.is_active = true
     WHERE u.id = $1`,
    [userId],
  );

  if (!userResult.rows[0]) return { applied: 0, skipped: 1, errors: 0 };

  const user = userResult.rows[0];
  const parsedResume = user.parsed_data;
  const resumePath = user.file_path;

  const stats = { applied: 0, skipped: 0, errors: 0 };

  for (const row of pendingResult.rows) {
    try {
      // Create pending application record
      const appResult = await query(
        `INSERT INTO applications (user_id, job_id, match_id, status, auto_applied)
         VALUES ($1, $2, $3, 'pending', true)
         ON CONFLICT (user_id, job_id) DO NOTHING
         RETURNING id`,
        [userId, row.job_id, row.match_id],
      );

      if (!appResult.rows[0]) {
        stats.skipped++;
        continue;
      }

      const applicationId = appResult.rows[0].id;
      const job = {
        id: row.job_id,
        company: row.company,
        role: row.role,
        description: row.description,
        application_url: row.application_url,
        location: row.location,
      };

      const botLog = await applyToJob({
        applicationId,
        job,
        candidate: { ...user, id: userId },
        parsedResume,
        resumePath,
      });

      // Update application record
      await query(
        `UPDATE applications SET
           status = $1,
           applied_at = $2,
           cover_letter = $3,
           bot_log = $4
         WHERE id = $5`,
        [
          botLog.success ? 'applied' : 'pending',
          botLog.success ? new Date() : null,
          botLog.cover_letter || null,
          JSON.stringify(botLog),
          applicationId,
        ],
      );

      // Activity log
      await query(
        `INSERT INTO activity_log (user_id, type, description, metadata)
         VALUES ($1, 'auto_apply', $2, $3)`,
        [
          userId,
          `Auto-applied to ${row.role} at ${row.company} (score: ${row.overall_score})`,
          JSON.stringify({ job_id: row.job_id, success: botLog.success }),
        ],
      );

      if (botLog.success) stats.applied++;
      else stats.errors++;

      await sleep(DELAY);
    } catch (err) {
      logger.error(`Auto-apply error for job ${row.job_id}:`, err.message);
      stats.errors++;
    }
  }

  logger.info(`Auto-apply complete for user ${userId}: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { applyToJob, runAutoApply, detectPlatform };
