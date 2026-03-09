/**
 * Indeed Job Scraper (Playwright-based)
 *
 * Scrapes Indeed's public job listings.
 * NOTE: For production use, prefer the Indeed Publisher API.
 */

const { chromium } = require('playwright');
const { sleep, normaliseUrl, parseSalary } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const HEADLESS = process.env.SCRAPER_HEADLESS !== 'false';
const TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10);

async function scrapeIndeedJobs(query, location = '', limit = 25) {
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();
  const jobs = [];

  try {
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location || 'United States');
    const url = `https://www.indeed.com/jobs?q=${encodedQuery}&l=${encodedLocation}&fromage=14&sort=date`;

    logger.info(`Indeed scraping: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await sleep(2000);

    // Handle cookie consent
    const acceptBtn = page.locator('button#onetrust-accept-btn-handler');
    if (await acceptBtn.count()) await acceptBtn.click();

    const jobCards = await page.$$('[data-testid="slider_item"], .job_seen_beacon, .resultContent');

    for (const card of jobCards.slice(0, limit)) {
      try {
        const title = await card.$eval('[data-testid="jobTitle"] span, .jobTitle span, h2.jobTitle a span', (el) => el.textContent?.trim()).catch(() => null);
        const company = await card.$eval('[data-testid="company-name"], .companyName', (el) => el.textContent?.trim()).catch(() => null);
        const loc = await card.$eval('[data-testid="text-location"], .companyLocation', (el) => el.textContent?.trim()).catch(() => null);
        const salaryEl = await card.$eval('[data-testid="attribute_snippet_testid"], .salary-snippet', (el) => el.textContent?.trim()).catch(() => null);
        const linkEl = await card.$eval('h2.jobTitle a, [data-testid="jobTitle"] a', (el) => el.getAttribute('href')).catch(() => null);
        const jobId = await card.getAttribute('data-jk').catch(() => null);

        if (title && company) {
          const salary = parseSalary(salaryEl || '');
          const fullLink = linkEl
            ? linkEl.startsWith('http')
              ? linkEl
              : `https://www.indeed.com${linkEl}`
            : null;

          jobs.push({
            external_id: jobId,
            source: 'indeed',
            company,
            role: title,
            location: loc,
            work_mode: detectWorkMode(loc || '', title),
            salary_min: salary.min,
            salary_max: salary.max,
            visa_sponsorship: false,
            description: null,
            application_url: normaliseUrl(fullLink),
            posted_at: null,
            raw_data: { title, company, location: loc, salary: salaryEl, link: fullLink },
          });
        }
      } catch (e) {
        // Skip malformed card
      }
    }

    logger.info(`Indeed: found ${jobs.length} jobs for "${query}"`);
  } catch (err) {
    logger.error('Indeed scraper error:', err.message);
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

module.exports = { scrapeIndeedJobs };
