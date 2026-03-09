/**
 * Company Research Service
 *
 * Uses OpenAI to generate a structured company research summary
 * for each newly discovered job. Results are stored in jobs.company_research.
 */

const OpenAI = require('openai');
const logger = require('../../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a structured company research summary.
 *
 * @param {string} company   Company name
 * @param {string} role      Job title (used for context)
 * @param {string} description  Job description snippet
 * @returns {object|null}    Research object or null on failure
 */
async function generateCompanyResearch(company, role, description) {
  const descSnippet = (description || '').slice(0, 600);

  const prompt = `You are a company research analyst. Provide a concise research summary for a job seeker.

Company: ${company}
Role being applied for: ${role}
Job description snippet: ${descSnippet}

Return a JSON object with exactly these fields:
{
  "overview": "2-3 sentence description of what the company does",
  "industry": "Primary industry (e.g. Fintech, SaaS, E-commerce, Healthcare)",
  "size": "Employee count estimate (e.g. '50-200', '1,000-5,000', '10,000+')",
  "founded": "Founding year as string, or null if unknown",
  "headquarters": "City, Country or null if unknown",
  "tech_stack": ["list", "of", "known", "technologies"],
  "hiring_difficulty": "Easy | Medium | Hard | Very Hard",
  "interview_process": ["Step 1 description", "Step 2 description"],
  "culture": "1-2 sentence culture description"
}

Use your training knowledge. If details are uncertain, provide your best estimate.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a company research specialist. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 600,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    logger.error(`Company research failed for "${company}": ${err.message}`);
    return null;
  }
}

module.exports = { generateCompanyResearch };
