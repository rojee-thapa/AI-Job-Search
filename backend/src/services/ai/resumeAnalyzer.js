/**
 * Resume Analyzer Service
 *
 * Extracts structured data from a resume text/file, generates improvement
 * tips, and creates a tailored, ATS-optimised version for each job.
 */

const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ─── File → Plain Text ───────────────────────────────────────

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  // Plain text fallback
  return buffer.toString('utf8');
}

// ─── Core Parse ──────────────────────────────────────────────

async function analyzeResume(rawText) {
  const prompt = `
You are an expert resume parser and career coach.

Parse the following resume and return a **strict JSON object** with these keys:
- full_name (string)
- email (string)
- phone (string)
- location (string)
- linkedin (string)
- github (string)
- summary (string)
- skills (array of strings — deduplicated, normalised)
- experience (array of objects: {company, title, start_date, end_date, description, achievements})
- education (array of objects: {institution, degree, field, graduation_year, gpa?})
- certifications (array of strings)
- languages (array of strings)
- years_of_experience (number — total estimated years)
- seniority_level (one of: junior | mid | senior | lead | principal | executive)
- preferred_roles (array of strings inferred from experience)
- preferred_locations (array of strings inferred from resume)
- visa_status (infer if possible, otherwise null)
- salary_expectation_min (integer USD/year, infer from seniority/location, or null)
- salary_expectation_max (integer USD/year, infer from seniority/location, or null)

Return ONLY the JSON object, no markdown fences, no extra text.

RESUME:
${rawText}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Improvement Tips ────────────────────────────────────────

async function generateImprovementTips(rawText) {
  const prompt = `
You are a senior technical recruiter and resume coach.

Review the following resume and return a JSON array of improvement suggestions.
Each suggestion must be an object with:
- category (one of: formatting | content | keywords | impact | structure | ats_optimisation)
- priority (high | medium | low)
- suggestion (string — concise, actionable)
- example (string — optional concrete example)

Focus on ATS optimisation, quantified achievements, strong action verbs, and relevance.
Return ONLY the JSON array.

RESUME:
${rawText}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  // Handle both {tips:[...]} and direct array
  return Array.isArray(parsed) ? parsed : parsed.tips || parsed.suggestions || [];
}

// ─── Tailored Resume ─────────────────────────────────────────

async function tailorResumeForJob(rawText, jobDescription, jobTitle, company) {
  const prompt = `
You are an expert resume writer specialising in ATS optimisation.

Rewrite the candidate's resume to be perfectly tailored for the following job.
- Keep all factual information accurate — do NOT invent experience or skills.
- Mirror keywords from the job description naturally throughout the resume.
- Strengthen bullet points with quantified impact where possible.
- Ensure the resume passes an ATS scan for this specific role.
- Return the rewritten resume as plain text (no markdown).

JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

ORIGINAL RESUME:
${rawText}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content;
}

// ─── Cover Letter ────────────────────────────────────────────

async function generateCoverLetter(parsedResume, job) {
  const prompt = `
You are a professional cover letter writer.

Write a compelling, personalised cover letter for the following job application.
- Address it to the hiring team at ${job.company}.
- Reference specific skills and achievements from the candidate's background.
- Mirror keywords from the job description.
- Keep it to 3–4 paragraphs, professional but warm.
- Do NOT start with "I am writing to..."
- Return plain text only.

CANDIDATE:
Name: ${parsedResume.full_name}
Summary: ${parsedResume.summary}
Top Skills: ${(parsedResume.skills || []).slice(0, 15).join(', ')}
Years of Experience: ${parsedResume.years_of_experience}

JOB:
Role: ${job.role}
Company: ${job.company}
Location: ${job.location || 'Remote'}

JOB DESCRIPTION:
${(job.description || '').slice(0, 2000)}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 800,
  });

  return response.choices[0].message.content;
}

// ─── Public API ──────────────────────────────────────────────

async function processResume(filePath) {
  logger.info(`Processing resume: ${filePath}`);
  const rawText = await extractTextFromFile(filePath);
  const [parsedData, improvementTips] = await Promise.all([
    analyzeResume(rawText),
    generateImprovementTips(rawText),
  ]);
  return { rawText, parsedData, improvementTips };
}

module.exports = {
  processResume,
  extractTextFromFile,
  analyzeResume,
  generateImprovementTips,
  tailorResumeForJob,
  generateCoverLetter,
};
