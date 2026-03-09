/**
 * AI Email Generator
 *
 * Generates personalised cold outreach, follow-up, and thank-you emails
 * using OpenAI, referencing the company, role, and candidate skills.
 */

const OpenAI = require('openai');
const logger = require('../../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ─── Cold Outreach Email ─────────────────────────────────────

async function generateColdOutreachEmail({ candidate, recruiter, job }) {
  const prompt = `
You are an expert career coach helping a job seeker write a compelling cold outreach email.

Write a concise, professional cold outreach email to a recruiter or hiring manager.
Guidelines:
- Subject line: punchy, specific, references the role
- Opening: personalised, references the company's work or recent news if possible
- Body: 2–3 sentences highlighting 2–3 relevant achievements/skills
- CTA: simple ask — 15-minute call or resume review
- Tone: confident, warm, concise (under 200 words total)
- Do NOT use generic phrases like "I hope this email finds you well"
- Return JSON: { "subject": "...", "body": "..." }

CANDIDATE:
Name: ${candidate.full_name}
Current/Last Role: ${candidate.experience?.[0]?.title || 'Software Engineer'}
Top Skills: ${(candidate.skills || []).slice(0, 8).join(', ')}
Key Achievement: ${candidate.experience?.[0]?.achievements?.[0] || 'Led key projects with measurable impact'}
Years of Experience: ${candidate.years_of_experience}

RECRUITER:
Name: ${recruiter.name || 'Hiring Manager'}
Company: ${recruiter.company}
Title: ${recruiter.title || 'Recruiter'}

JOB:
Role: ${job.role}
Company: ${job.company}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Follow-Up Email ─────────────────────────────────────────

async function generateFollowUpEmail({ candidate, job, daysSinceApplied }) {
  const prompt = `
Write a brief, professional follow-up email for a job application.
- Remind them of the application without being pushy
- Reiterate enthusiasm for the role with one specific reason
- Polite CTA: ask for a status update
- Under 100 words
- Return JSON: { "subject": "...", "body": "..." }

CANDIDATE: ${candidate.full_name}
ROLE: ${job.role}
COMPANY: ${job.company}
DAYS SINCE APPLIED: ${daysSinceApplied}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Thank You Email ─────────────────────────────────────────

async function generateThankYouEmail({ candidate, job, interviewerName, interviewTopics }) {
  const prompt = `
Write a professional post-interview thank-you email.
- Express gratitude and reference a specific topic discussed
- Reiterate one key reason you're the right fit
- Under 150 words
- Return JSON: { "subject": "...", "body": "..." }

CANDIDATE: ${candidate.full_name}
INTERVIEWER: ${interviewerName || 'the hiring team'}
ROLE: ${job.role}
COMPANY: ${job.company}
TOPICS DISCUSSED: ${(interviewTopics || []).join(', ') || 'technical challenges and team culture'}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Recruiter Finder Prompt ─────────────────────────────────

async function findRecruiterEmailHint(company, role) {
  const prompt = `
You are a research assistant helping find recruiter contact information.
For the company "${company}" hiring for a "${role}" role, provide:
1. Common email format pattern (e.g., firstname.lastname@company.com)
2. Where to find the recruiter (LinkedIn search tips)
3. Any known HR/recruiting contact email if publicly known

Return JSON: { "email_pattern": "...", "linkedin_search": "...", "notes": "..." }
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  generateColdOutreachEmail,
  generateFollowUpEmail,
  generateThankYouEmail,
  findRecruiterEmailHint,
};
