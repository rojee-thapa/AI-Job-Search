/**
 * Job Aggregator
 *
 * Orchestrates all job discovery sources, deduplicates results,
 * and persists them to the database.
 */

const { scrapeLinkedInJobs } = require('./linkedinScraper');
const { scrapeIndeedJobs } = require('./indeedScraper');
const { scrapeWellfoundJobs } = require('./wellfoundScraper');
const { discoverJobsViaPerplexity, discoverHiddenJobs } = require('./perplexityDiscovery');
const { generateCompanyResearch } = require('../ai/companyResearch');
const { query } = require('../../config/database');
const { sleep } = require('../../utils/helpers');
const logger = require('../../utils/logger');

// ─── Deduplication ───────────────────────────────────────────

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.source}:${job.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Persist to DB ───────────────────────────────────────────

async function persistJobs(jobs) {
  const inserted = [];

  for (const job of jobs) {
    try {
      const result = await query(
        `INSERT INTO jobs (
          external_id, source, company, role, location, work_mode,
          salary_min, salary_max, visa_sponsorship, description,
          application_url, posted_at, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (source, external_id) DO UPDATE SET
          role = EXCLUDED.role,
          description = COALESCE(EXCLUDED.description, jobs.description),
          salary_min = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
          salary_max = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
          updated_at = NOW()
        RETURNING *`,
        [
          job.external_id,
          job.source,
          job.company,
          job.role,
          job.location,
          job.work_mode,
          job.salary_min,
          job.salary_max,
          job.visa_sponsorship,
          job.description,
          job.application_url,
          job.posted_at,
          JSON.stringify(job.raw_data || {}),
        ],
      );

      if (result.rows[0]) inserted.push(result.rows[0]);
    } catch (err) {
      logger.error(`Failed to persist job (${job.source}/${job.external_id}): ${err.message}`);
    }
  }

  return inserted;
}

// ─── Main Discovery Pipeline ─────────────────────────────────

async function runJobDiscovery(preferences, parsedResume) {
  const roles = preferences.target_roles?.length
    ? preferences.target_roles
    : parsedResume?.preferred_roles || ['Software Engineer'];

  const location = preferences.preferred_locations?.[0] || '';

  logger.info(`Starting job discovery for roles: ${roles.join(', ')}`);

  const allJobs = [];

  // Run scrapers in parallel per role (with rate-limiting between sources)
  for (const role of roles.slice(0, 3)) {
    const [perplexityJobs, hiddenJobs, wellfoundJobs] = await Promise.allSettled([
      discoverJobsViaPerplexity(preferences, parsedResume),
      discoverHiddenJobs(preferences, parsedResume),
      scrapeWellfoundJobs(role, location, 20),
    ]);

    if (perplexityJobs.status === 'fulfilled') allJobs.push(...perplexityJobs.value);
    if (hiddenJobs.status === 'fulfilled') allJobs.push(...hiddenJobs.value);
    if (wellfoundJobs.status === 'fulfilled') allJobs.push(...wellfoundJobs.value);

    // Playwright scrapers run sequentially to avoid resource exhaustion
    try {
      const linkedinJobs = await scrapeLinkedInJobs(role, location, 25);
      allJobs.push(...linkedinJobs);
      await sleep(3000);
    } catch (e) {
      logger.warn(`LinkedIn scraper skipped: ${e.message}`);
    }

    try {
      const indeedJobs = await scrapeIndeedJobs(role, location, 25);
      allJobs.push(...indeedJobs);
      await sleep(3000);
    } catch (e) {
      logger.warn(`Indeed scraper skipped: ${e.message}`);
    }
  }

  const unique = deduplicateJobs(allJobs);
  logger.info(`Job discovery complete: ${unique.length} unique jobs found`);

  const persisted = await persistJobs(unique);
  logger.info(`Persisted ${persisted.length} jobs to database`);

  // Fire-and-forget: generate company research for jobs that don't have it yet.
  // Deduplicate by company to avoid redundant API calls.
  setImmediate(async () => {
    const seen = new Set();
    for (const job of persisted) {
      if (job.company_research || seen.has(job.company)) continue;
      seen.add(job.company);
      try {
        const research = await generateCompanyResearch(job.company, job.role, job.description);
        if (research) {
          await query(
            'UPDATE jobs SET company_research = $1 WHERE id = $2',
            [JSON.stringify(research), job.id],
          );
        }
      } catch (e) {
        logger.error(`Company research update failed for job ${job.id}: ${e.message}`);
      }
    }
    logger.info('Company research generation complete');
  });

  return persisted;
}

/**
 * Fetch jobs from DB filtered by user preferences and match score.
 */
async function fetchMatchedJobs(userId, { page = 1, limit = 20, minScore = 0, status = null } = {}) {
  const offset = (page - 1) * limit;

  const conditions = ['jm.user_id = $1', 'jm.overall_score >= $2'];
  const params = [userId, minScore];

  if (status) {
    conditions.push(`a.status = $${params.length + 1}`);
    params.push(status);
  }

  const baseQuery = `
    SELECT
      j.*,
      jm.overall_score,
      jm.skills_score,
      jm.experience_score,
      jm.salary_score,
      jm.location_score,
      jm.visa_score,
      jm.matched_skills,
      jm.missing_skills,
      a.status AS application_status,
      a.id AS application_id
    FROM job_matches jm
    JOIN jobs j ON j.id = jm.job_id
    LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1
    WHERE ${conditions.join(' AND ')}
    ORDER BY jm.overall_score DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);

  const [dataResult, countResult] = await Promise.all([
    query(baseQuery, params),
    query(
      `SELECT COUNT(*) FROM job_matches jm WHERE jm.user_id = $1 AND jm.overall_score >= $2`,
      [userId, minScore],
    ),
  ]);

  return {
    jobs: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
    totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
  };
}

module.exports = { runJobDiscovery, persistJobs, deduplicateJobs, fetchMatchedJobs };
