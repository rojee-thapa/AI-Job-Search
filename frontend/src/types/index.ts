// ─── Auth ────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

// ─── Resume ──────────────────────────────────────────────────
export interface ParsedResume {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  certifications: string[];
  years_of_experience: number;
  seniority_level: 'new grad' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive';
  preferred_roles: string[];
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
}

export interface WorkExperience {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  description: string;
  achievements: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduation_year: number;
  gpa?: number;
}

export interface Resume {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  parsed_data: ParsedResume;
  improvement_tips: ImprovementTip[];
  is_active: boolean;
  created_at: string;
}

export interface ImprovementTip {
  category: 'formatting' | 'content' | 'keywords' | 'impact' | 'structure' | 'ats_optimisation';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  example?: string;
}

// ─── Jobs ────────────────────────────────────────────────────
export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'flexible';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance';
export type ApplicationStatus =
  | 'pending'
  | 'applied'
  | 'interview_scheduled'
  | 'interviewed'
  | 'offer_received'
  | 'rejected'
  | 'withdrawn'
  | 'follow_up_sent'
  | 'saved';  // client-side status derived from job_matches.is_saved

/** AI-generated company research summary */
export interface CompanyResearch {
  overview: string;
  industry: string;
  size: string;
  founded: string | null;
  headquarters: string | null;
  tech_stack: string[];
  hiring_difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
  interview_process: string[];
  culture: string;
}

export interface Job {
  id: string;
  source: string;
  company: string;
  role: string;
  location: string | null;
  work_mode: WorkMode;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  visa_sponsorship: boolean;
  description: string | null;
  application_url: string | null;
  posted_at: string | null;
  is_active: boolean;
  company_research: CompanyResearch | null;
  // From join with job_matches
  overall_score?: number;
  skills_score?: number;
  experience_score?: number;
  salary_score?: number;
  location_score?: number;
  visa_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  is_saved?: boolean;
  match_id?: string;
  application_status?: ApplicationStatus;
  application_id?: string;
  applied_at?: string;
}

// ─── Applications ────────────────────────────────────────────
export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  follow_up_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  notes: string | null;
  cover_letter: string | null;
  auto_applied: boolean;
  // From join
  company: string;
  role: string;
  location: string | null;
  work_mode: WorkMode;
  application_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  source: string;
  overall_score: number | null;
}

// ─── Email ───────────────────────────────────────────────────
export interface Email {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  type: 'cold_outreach' | 'follow_up' | 'thank_you' | 'daily_alert';
  status: 'queued' | 'sent' | 'failed' | 'opened' | 'replied';
  sent_at: string | null;
  opened_at: string | null;
  company?: string;
  role?: string;
}

// ─── Interview ───────────────────────────────────────────────
export interface InterviewQuestion {
  question: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  framework?: string;
  suggested_answer: string;
  tips?: string;
  what_they_look_for?: string;
}

export interface InterviewSession {
  id: string;
  job_id: string;
  company: string;
  role: string;
  scheduled_at: string | null;
  created_at: string;
  questions: {
    technical: InterviewQuestion[];
    behavioural: InterviewQuestion[];
    system_design: InterviewQuestion[];
    company_specific: InterviewQuestion[];
    questions_to_ask: string[];
    preparation_tips: string[];
    company_brief?: Record<string, unknown>;
  };
  application_status?: ApplicationStatus;
}

// ─── Preferences ─────────────────────────────────────────────
export type RoleSeniority = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive';

export interface UserPreferences {
  user_id: string;
  target_roles: string[];
  preferred_locations: string[];
  remote_ok: boolean;
  min_salary: number | null;
  max_salary: number | null;
  visa_status: string;
  requires_sponsorship: boolean;
  years_experience: number | null;
  employment_types: EmploymentType[];
  work_modes: WorkMode[];
  excluded_companies: string[];
  daily_application_limit: number;
  auto_apply_enabled: boolean;
  min_match_score: number;
  alert_email: string | null;
  alert_hour: number;
  // Migration 002: new preference fields
  role_seniority: RoleSeniority[];
  degree_required: boolean;
  degree_subjects: string[];
}

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardStats {
  applications: {
    total: string;
    applied: string;
    interviews: string;
    offers: string;
    applied_today: string;
  };
  jobs: {
    total: string;
    avg_score: string;
  };
  emails: {
    sent: string;
    opened: string;
  };
  recent_activity: ActivityItem[];
  upcoming_interviews: UpcomingInterview[];
}

export interface ActivityItem {
  type: string;
  description: string;
  created_at: string;
}

export interface UpcomingInterview {
  company: string;
  role: string;
  interview_at: string;
  application_id: string;
}

// ─── Pagination ──────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
