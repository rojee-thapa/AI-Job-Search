/**
 * Job Matching Algorithm
 *
 * Scoring weights:
 *   40% — Skills match
 *   20% — Experience match
 *   15% — Salary compatibility
 *   15% — Location compatibility
 *   10% — Visa sponsorship compatibility
 */

const { clamp } = require('../../utils/helpers');

const WEIGHTS = {
  skills: 0.40,
  experience: 0.20,
  salary: 0.15,
  location: 0.15,
  visa: 0.10,
};

// ─── Individual Scorers ──────────────────────────────────────

/**
 * Skills score: Jaccard-like overlap between candidate skills and required skills
 * extracted from the job description keywords.
 */
function scoreSkills(candidateSkills, jobSkills) {
  if (!candidateSkills?.length || !jobSkills?.length) return 50;

  const normalize = (s) => s.toLowerCase().trim();
  const cSet = new Set(candidateSkills.map(normalize));
  const jSet = new Set(jobSkills.map(normalize));

  let matched = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of jSet) {
    if (cSet.has(skill) || [...cSet].some((cs) => cs.includes(skill) || skill.includes(cs))) {
      matched++;
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const score = jSet.size > 0 ? (matched / jSet.size) * 100 : 50;
  return { score: clamp(score, 0, 100), matchedSkills, missingSkills };
}

/**
 * Experience score: how closely the candidate's years of experience aligns with
 * the job's required range.
 */
function scoreExperience(candidateYears, jobMinYears, jobMaxYears) {
  if (!candidateYears) return 60;
  if (!jobMinYears && !jobMaxYears) return 75;

  const min = jobMinYears || 0;
  const max = jobMaxYears || min + 5;

  if (candidateYears >= min && candidateYears <= max) return 100;
  if (candidateYears > max) {
    // Overqualified — small penalty
    const overshoot = (candidateYears - max) / max;
    return clamp(100 - overshoot * 20, 50, 95);
  }
  // Underqualified
  const gap = min - candidateYears;
  return clamp(100 - (gap / min) * 100, 0, 80);
}

/**
 * Salary score: compatibility between candidate expectation and job salary.
 */
function scoreSalary(candidateMin, candidateMax, jobMin, jobMax) {
  if (!candidateMin && !candidateMax) return 75;
  if (!jobMin && !jobMax) return 75;

  const cMin = candidateMin || 0;
  const cMax = candidateMax || cMin * 1.3;
  const jMin = jobMin || 0;
  const jMax = jobMax || jMin * 1.3;

  // Check for overlap
  const overlapMin = Math.max(cMin, jMin);
  const overlapMax = Math.min(cMax, jMax);

  if (overlapMax >= overlapMin) {
    const overlapRange = overlapMax - overlapMin;
    const totalRange = Math.max(cMax, jMax) - Math.min(cMin, jMin);
    return clamp((overlapRange / totalRange) * 100 + 40, 0, 100);
  }

  // No overlap
  const gap = overlapMin - overlapMax;
  const refSalary = (jMin + jMax) / 2 || 1;
  return clamp(100 - (gap / refSalary) * 100, 0, 40);
}

/**
 * Location score: remote/hybrid/onsite compatibility.
 */
function scoreLocation(candidatePrefs, jobWorkMode, jobLocation) {
  const { locations = [], workModes = [], remoteOk = true } = candidatePrefs;

  if (jobWorkMode === 'remote') {
    return remoteOk || workModes.includes('remote') ? 100 : 20;
  }

  if (remoteOk && workModes.includes('remote')) {
    if (jobWorkMode === 'hybrid') return 80;
    if (jobWorkMode === 'onsite') return 50;
  }

  if (!jobLocation) return 70;

  const normalize = (s) => s?.toLowerCase().trim() || '';
  const jLoc = normalize(jobLocation);
  const match = locations.some((l) => {
    const nl = normalize(l);
    return jLoc.includes(nl) || nl.includes(jLoc);
  });

  if (match) return 100;
  if (workModes.includes('hybrid') && jobWorkMode === 'hybrid') return 70;
  return 30;
}

/**
 * Visa score: does the job sponsor? Does the candidate need sponsorship?
 */
function scoreVisa(requiresSponsorship, jobOffersSponsorship) {
  if (!requiresSponsorship) return 100;
  if (jobOffersSponsorship) return 100;
  return 0; // Candidate needs sponsorship but job doesn't offer it
}

// ─── Extract Job Skills from Description ────────────────────

const COMMON_TECH_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab',
  'react', 'next.js', 'vue', 'angular', 'svelte',
  'node.js', 'express', 'fastapi', 'django', 'flask', 'spring', 'rails',
  'graphql', 'rest', 'grpc', 'websocket',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
  'ci/cd', 'github actions', 'jenkins', 'gitlab ci',
  'machine learning', 'deep learning', 'nlp', 'pytorch', 'tensorflow',
  'openai', 'llm', 'rag', 'langchain',
  'git', 'linux', 'bash', 'sql', 'nosql', 'microservices', 'serverless',
];

function extractSkillsFromJD(description) {
  if (!description) return [];
  const lower = description.toLowerCase();
  return COMMON_TECH_SKILLS.filter((skill) => lower.includes(skill));
}

function extractExperienceRequirement(description) {
  if (!description) return { min: null, max: null };
  const patterns = [
    /(\d+)\+?\s*(?:to|-)\s*(\d+)\s*years?/i,
    /(\d+)\+\s*years?/i,
    /(\d+)\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
    /minimum\s+(?:of\s+)?(\d+)\s*years?/i,
  ];

  for (const re of patterns) {
    const m = description.match(re);
    if (m) {
      const min = parseInt(m[1], 10);
      const max = m[2] ? parseInt(m[2], 10) : min + 3;
      return { min, max };
    }
  }
  return { min: null, max: null };
}

// ─── Main Matching Function ──────────────────────────────────

function matchJobToCandidate(job, parsedResume, preferences) {
  const jobSkills = extractSkillsFromJD(job.description);
  const expReq = extractExperienceRequirement(job.description);

  const skillsResult = scoreSkills(parsedResume.skills, jobSkills);
  const skillsScore = typeof skillsResult === 'object' ? skillsResult.score : skillsResult;
  const matchedSkills = skillsResult.matchedSkills || [];
  const missingSkills = skillsResult.missingSkills || [];

  const experienceScore = scoreExperience(
    parsedResume.years_of_experience,
    expReq.min,
    expReq.max,
  );

  const salaryScore = scoreSalary(
    preferences.min_salary || parsedResume.salary_expectation_min,
    preferences.max_salary || parsedResume.salary_expectation_max,
    job.salary_min,
    job.salary_max,
  );

  const locationScore = scoreLocation(
    {
      locations: preferences.preferred_locations || parsedResume.preferred_locations,
      workModes: preferences.work_modes,
      remoteOk: preferences.remote_ok,
    },
    job.work_mode,
    job.location,
  );

  const visaScore = scoreVisa(
    preferences.requires_sponsorship,
    job.visa_sponsorship,
  );

  const overall =
    skillsScore * WEIGHTS.skills +
    experienceScore * WEIGHTS.experience +
    salaryScore * WEIGHTS.salary +
    locationScore * WEIGHTS.location +
    visaScore * WEIGHTS.visa;

  return {
    overall_score: parseFloat(overall.toFixed(2)),
    skills_score: parseFloat(skillsScore.toFixed(2)),
    experience_score: parseFloat(experienceScore.toFixed(2)),
    salary_score: parseFloat(salaryScore.toFixed(2)),
    location_score: parseFloat(locationScore.toFixed(2)),
    visa_score: parseFloat(visaScore.toFixed(2)),
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    score_breakdown: {
      weights: WEIGHTS,
      job_skills_found: jobSkills,
      exp_requirement: expReq,
    },
  };
}

/**
 * Match and rank an array of jobs, filtering by min_match_score.
 */
function rankJobs(jobs, parsedResume, preferences) {
  const minScore = preferences.min_match_score || 0;

  return jobs
    .map((job) => ({
      job,
      match: matchJobToCandidate(job, parsedResume, preferences),
    }))
    .filter(({ match }) => match.overall_score >= minScore)
    .sort((a, b) => b.match.overall_score - a.match.overall_score);
}

module.exports = { matchJobToCandidate, rankJobs, extractSkillsFromJD };
