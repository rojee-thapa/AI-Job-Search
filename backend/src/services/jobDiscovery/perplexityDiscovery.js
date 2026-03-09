/**
 * Perplexity AI Job Discovery
 *
 * Uses Perplexity's online-search model to surface hidden jobs, stealth
 * postings, and real-time opportunities not yet indexed on public boards.
 */

const axios = require('axios');
const { parseSalary, normaliseUrl } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';

async function discoverJobsViaPerplexity(preferences, parsedResume) {
  const { target_roles = [], preferred_locations = [], remote_ok = true, min_salary, max_salary, visa_status } = preferences;

  const roles = target_roles.slice(0, 3).join(', ') || parsedResume?.preferred_roles?.slice(0, 2).join(', ') || 'Software Engineer';
  const locations = remote_ok ? 'remote or ' + (preferred_locations.slice(0, 2).join(', ') || 'United States') : preferred_locations.slice(0, 2).join(', ') || 'United States';
  const salaryInfo = min_salary ? `, salary range $${Math.round(min_salary / 1000)}k–$${Math.round((max_salary || min_salary * 1.5) / 1000)}k` : '';
  const skills = (parsedResume?.skills || []).slice(0, 10).join(', ');

  const systemPrompt = `You are a job search assistant that finds real, current job openings.
Always return valid JSON. Only include jobs that are genuinely open right now.
Extract as much detail as possible from job postings you find.`;

  const userPrompt = `Find current job openings for the following profile and return them as a JSON array.

SEARCH CRITERIA:
- Roles: ${roles}
- Location: ${locations}${salaryInfo}
- Key Skills: ${skills}
- Posted: within the last 30 days

For each job return:
{
  "company": "Company name",
  "role": "Exact job title",
  "location": "City, State or Remote",
  "work_mode": "remote|hybrid|onsite",
  "salary_min": number or null,
  "salary_max": number or null,
  "visa_sponsorship": true/false,
  "application_url": "direct link to apply",
  "description": "brief description from the posting",
  "source": "board name (LinkedIn/Indeed/company site/etc)",
  "posted_at": "YYYY-MM-DD or null"
}

Find at least 10 unique, real job postings. Return a JSON object: { "jobs": [...] }`;

  try {
    const response = await axios.post(
      PERPLEXITY_API,
      {
        model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const content = response.data.choices[0].message.content;

    // Strip markdown fences if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs || [];

    return jobs.map((j) => normaliseJob(j, 'perplexity'));
  } catch (err) {
    logger.error('Perplexity discovery error:', err.message);
    return [];
  }
}

/**
 * Hidden job search — target companies not actively posting publicly.
 */
async function discoverHiddenJobs(preferences, parsedResume) {
  const roles = (preferences.target_roles || []).slice(0, 2).join(', ') || 'Software Engineer';
  const skills = (parsedResume?.skills || []).slice(0, 8).join(', ');

  const userPrompt = `Find "hidden" or unadvertised job opportunities for ${roles} developers with skills in ${skills}.

Look for:
1. Companies that recently raised funding and are likely hiring
2. Companies with high Glassdoor ratings currently expanding their engineering team
3. Startups in stealth mode or early stage hiring
4. Jobs posted on company career pages but not yet on job boards
5. LinkedIn posts from engineering managers/VPs looking for candidates

Return JSON: { "jobs": [...], "companies_to_watch": ["company1", "company2"] }
Each job must have: company, role, location, work_mode, application_url, description, source`;

  try {
    const response = await axios.post(
      PERPLEXITY_API,
      {
        model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online',
        messages: [
          { role: 'system', content: 'You are a job market research specialist. Return valid JSON only.' },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const content = response.data.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs || [];

    return jobs.map((j) => normaliseJob(j, 'perplexity_hidden'));
  } catch (err) {
    logger.error('Perplexity hidden job search error:', err.message);
    return [];
  }
}

// ─── Normalise raw Perplexity result ─────────────────────────

function normaliseJob(raw, source) {
  const salary = parseSalary(raw.salary_range || '');
  return {
    external_id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source,
    company: raw.company || 'Unknown',
    role: raw.role || raw.title || 'Unknown Role',
    location: raw.location || null,
    work_mode: normaliseWorkMode(raw.work_mode),
    salary_min: raw.salary_min || salary.min,
    salary_max: raw.salary_max || salary.max,
    visa_sponsorship: !!raw.visa_sponsorship,
    description: raw.description || null,
    application_url: normaliseUrl(raw.application_url),
    posted_at: raw.posted_at ? new Date(raw.posted_at) : null,
    raw_data: raw,
  };
}

function normaliseWorkMode(mode) {
  if (!mode) return 'onsite';
  const m = mode.toLowerCase();
  if (m.includes('remote')) return 'remote';
  if (m.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

module.exports = { discoverJobsViaPerplexity, discoverHiddenJobs };
