/**
 * AI Interview Preparation Service
 *
 * Generates company-specific technical, behavioural, and system design
 * questions with tailored suggested answers.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ─── Question Generation ─────────────────────────────────────

async function generateInterviewQuestions({ job, parsedResume }) {
  const prompt = `
You are a senior technical interviewer and career coach preparing a candidate for a job interview.

Generate a comprehensive interview preparation guide with questions and suggested answers
tailored to the specific company, role, and candidate background.

Return a JSON object with:
{
  "technical": [
    {
      "question": "...",
      "category": "data structures | algorithms | system design | domain-specific | coding",
      "difficulty": "easy | medium | hard",
      "suggested_answer": "...",
      "tips": "..."
    }
  ],
  "behavioural": [
    {
      "question": "...",
      "framework": "STAR",
      "suggested_answer": "... (use STAR format, reference candidate's experience)",
      "what_they_look_for": "..."
    }
  ],
  "system_design": [
    {
      "question": "...",
      "approach": "step-by-step design approach",
      "key_considerations": ["scalability", "..."],
      "example_answer_outline": "..."
    }
  ],
  "company_specific": [
    {
      "question": "...",
      "context": "why this company asks this",
      "suggested_answer": "..."
    }
  ],
  "questions_to_ask": [
    "Question the candidate should ask the interviewer..."
  ],
  "preparation_tips": ["..."]
}

Generate at least:
- 5 technical questions
- 5 behavioural questions
- 2 system design questions
- 3 company-specific questions
- 5 questions to ask the interviewer

ROLE: ${job.role}
COMPANY: ${job.company}
LOCATION: ${job.location || 'Remote'}
JOB DESCRIPTION:
${(job.description || '').slice(0, 2500)}

CANDIDATE BACKGROUND:
Skills: ${(parsedResume.skills || []).slice(0, 20).join(', ')}
Experience: ${parsedResume.years_of_experience} years
Seniority: ${parsedResume.seniority_level}
Recent Role: ${parsedResume.experience?.[0]?.title} at ${parsedResume.experience?.[0]?.company}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Practice Answer Feedback ────────────────────────────────

async function evaluatePracticeAnswer({ question, answer, jobContext }) {
  const prompt = `
You are an expert interview coach. Evaluate the candidate's practice answer.

Return JSON:
{
  "score": 1-10,
  "strengths": ["..."],
  "improvements": ["..."],
  "revised_answer": "Improved version of the answer",
  "missing_elements": ["..."]
}

JOB: ${jobContext.role} at ${jobContext.company}
QUESTION: ${question}
CANDIDATE'S ANSWER: ${answer}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Company Research Brief ──────────────────────────────────

async function generateCompanyBrief(company, role) {
  const prompt = `
You are a research analyst. Provide an interview preparation brief for a candidate
interviewing at "${company}" for a "${role}" position.

Return JSON:
{
  "company_overview": "...",
  "culture_values": ["..."],
  "recent_news": ["..."],
  "products_services": ["..."],
  "tech_stack": ["..."],
  "interview_process": "typical process description",
  "glassdoor_insights": "common themes from reviews",
  "key_talking_points": ["..."]
}
`.trim();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = {
  generateInterviewQuestions,
  evaluatePracticeAnswer,
  generateCompanyBrief,
};
