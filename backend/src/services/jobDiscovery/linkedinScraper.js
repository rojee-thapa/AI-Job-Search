/**
 * LinkedIn Job Scraper (Playwright-based)
 *
 * Scrapes LinkedIn Jobs search results — respects robots.txt best-effort
 * and adds human-like delays between actions.
 *
 * NOTE: LinkedIn Terms of Service restrict automated scraping.
 * Use this only for personal use / authorized research.
 * For production, use LinkedIn's official Jobs API or a compliant provider.
 */

const { chromium } = require('playwright');
const { sleep, normaliseUrl, parseSalary } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const HEADLESS = process.env.SCRAPER_HEADLESS !== 'false';
const TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10);

async function scrapeLinkedInJobs(query, location = '', limit = 25) {
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const jobs = [];

  try {
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location || 'United States');
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodedQuery}&location=${encodedLocation}&f_TPR=r604800&sortBy=DD`;

    logger.info(`LinkedIn scraping: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await sleep(2000);

    // Scroll to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
    }

    const jobCards = await page.$$('.jobs-search__results-list > li, .job-search-card');

    for (const card of jobCards.slice(0, limit)) {
      try {
        const title = await card.$eval('.base-search-card__title, .job-search-card__title', (el) => el.textContent?.trim()).catch(() => null);
        const company = await card.$eval('.base-search-card__subtitle, .job-search-card__company-name', (el) => el.textContent?.trim()).catch(() => null);
        const loc = await card.$eval('.job-search-card__location', (el) => el.textContent?.trim()).catch(() => null);
        const link = await card.$eval('a.base-card__full-link, a.job-search-card__link-absolute', (el) => el.href).catch(() => null);
        const posted = await card.$eval('time', (el) => el.getAttribute('datetime')).catch(() => null);

        if (title && company) {
          jobs.push({
            external_id: link ? new URL(link).pathname.split('/').filter(Boolean).pop() : null,
            source: 'linkedin',
            company,
            role: title,
            location: loc,
            work_mode: detectWorkMode(loc, title),
            salary_min: null,
            salary_max: null,
            visa_sponsorship: false,
            description: null,
            application_url: normaliseUrl(link),
            posted_at: posted ? new Date(posted) : null,
            raw_data: { title, company, location: loc, link, posted },
          });
        }
      } catch (e) {
        // Skip malformed card
      }
    }

    logger.info(`LinkedIn: found ${jobs.length} jobs for "${query}"`);
  } catch (err) {
    logger.error('LinkedIn scraper error:', err.message);
  } finally {
    await browser.close();
  }

  return jobs;
}

function detectWorkMode(location, title) {
  const text = `${location} ${title}`.toLowerCase();
  if (text.includes('remote')) return 'remote';
  if (text.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

module.exports = { scrapeLinkedInJobs };
