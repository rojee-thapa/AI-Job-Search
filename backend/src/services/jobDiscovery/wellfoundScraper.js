/**
 * Wellfound (formerly AngelList) Job Scraper
 *
 * Targets startup and early-stage company listings.
 */

const axios = require('axios');
const { normaliseUrl, parseSalary } = require('../../utils/helpers');
const logger = require('../../utils/logger');

// Wellfound has a public API for job listings
const WELLFOUND_JOBS_API = 'https://wellfound.com/graphql';

async function scrapeWellfoundJobs(role, location = '', limit = 20) {
  const jobs = [];

  try {
    // Wellfound graphql query for job search
    const query = `
      query StartupJobsListQuery($query: String, $locationSlug: String, $page: Int) {
        startupJobsIndex(query: $query, locationSlug: $locationSlug, page: $page) {
          startupJobs {
            id
            title
            description
            remote
            locationNames
            compensation
            equity
            startup {
              name
              websiteUrl
              twitterUrl
              productDescription
            }
            applyUrl
            createdAt
          }
        }
      }
    `;

    const response = await axios.post(
      WELLFOUND_JOBS_API,
      {
        query,
        variables: {
          query: role,
          locationSlug: location ? location.toLowerCase().replace(/\s+/g, '-') : '',
          page: 1,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 20000,
      },
    );

    const listings = response.data?.data?.startupJobsIndex?.startupJobs || [];

    for (const job of listings.slice(0, limit)) {
      const salary = parseSalary(job.compensation || '');
      jobs.push({
        external_id: String(job.id),
        source: 'wellfound',
        company: job.startup?.name || 'Unknown Startup',
        role: job.title || role,
        location: job.remote ? 'Remote' : (job.locationNames || []).join(', '),
        work_mode: job.remote ? 'remote' : 'onsite',
        salary_min: salary.min,
        salary_max: salary.max,
        visa_sponsorship: false,
        description: job.description || job.startup?.productDescription || null,
        application_url: normaliseUrl(job.applyUrl),
        posted_at: job.createdAt ? new Date(job.createdAt) : null,
        raw_data: job,
      });
    }

    logger.info(`Wellfound: found ${jobs.length} jobs for "${role}"`);
  } catch (err) {
    logger.error('Wellfound scraper error:', err.message);
  }

  return jobs;
}

module.exports = { scrapeWellfoundJobs };
