-- ============================================================
-- AI Job Agent — Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Enums ───────────────────────────────────────────────────
CREATE TYPE visa_type AS ENUM (
  'citizen', 'green_card', 'h1b', 'opt', 'tn', 'e3', 'other', 'no_visa_required'
);

CREATE TYPE employment_type AS ENUM (
  'full_time', 'part_time', 'contract', 'internship', 'freelance'
);

CREATE TYPE work_mode AS ENUM ('remote', 'hybrid', 'onsite', 'flexible');

CREATE TYPE application_status AS ENUM (
  'pending', 'applied', 'interview_scheduled', 'interviewed',
  'offer_received', 'rejected', 'withdrawn', 'follow_up_sent'
);

CREATE TYPE email_status AS ENUM ('queued', 'sent', 'failed', 'opened', 'replied');

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Preferences ────────────────────────────────────────
CREATE TABLE user_preferences (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_roles            TEXT[]            DEFAULT '{}',
  preferred_locations     TEXT[]            DEFAULT '{}',
  remote_ok               BOOLEAN           DEFAULT TRUE,
  min_salary              INTEGER,
  max_salary              INTEGER,
  visa_status             visa_type         DEFAULT 'citizen',
  requires_sponsorship    BOOLEAN           DEFAULT FALSE,
  years_experience        NUMERIC(4,1),
  employment_types        employment_type[] DEFAULT '{full_time}',
  work_modes              work_mode[]       DEFAULT '{remote,hybrid}',
  excluded_companies      TEXT[]            DEFAULT '{}',
  daily_application_limit INTEGER           DEFAULT 10,
  auto_apply_enabled      BOOLEAN           DEFAULT FALSE,
  min_match_score         NUMERIC(5,2)      DEFAULT 70.0,
  alert_email             TEXT,
  alert_hour              INTEGER           DEFAULT 8,
  created_at              TIMESTAMPTZ       DEFAULT NOW(),
  updated_at              TIMESTAMPTZ       DEFAULT NOW()
);

-- ─── Resumes ─────────────────────────────────────────────────
CREATE TABLE resumes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_size         INTEGER,
  mime_type         TEXT,
  raw_text          TEXT,
  parsed_data       JSONB,           -- skills, experience, education, etc.
  optimized_text    TEXT,            -- AI-optimized version
  improvement_tips  JSONB,           -- array of improvement suggestions
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Jobs ────────────────────────────────────────────────────
CREATE TABLE jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id         TEXT,
  source              TEXT NOT NULL,           -- linkedin, indeed, glassdoor, wellfound, perplexity, etc.
  company             TEXT NOT NULL,
  role                TEXT NOT NULL,
  location            TEXT,
  work_mode           work_mode,
  employment_type     employment_type,
  salary_min          INTEGER,
  salary_max          INTEGER,
  salary_currency     TEXT DEFAULT 'USD',
  visa_sponsorship    BOOLEAN DEFAULT FALSE,
  description         TEXT,
  requirements        JSONB,
  application_url     TEXT,
  company_url         TEXT,
  posted_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT TRUE,
  raw_data            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_role ON jobs USING gin(to_tsvector('english', role));
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);

-- ─── Job Matches ─────────────────────────────────────────────
CREATE TABLE job_matches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id                UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id             UUID REFERENCES resumes(id),
  overall_score         NUMERIC(5,2),
  skills_score          NUMERIC(5,2),
  experience_score      NUMERIC(5,2),
  salary_score          NUMERIC(5,2),
  location_score        NUMERIC(5,2),
  visa_score            NUMERIC(5,2),
  score_breakdown       JSONB,
  matched_skills        TEXT[],
  missing_skills        TEXT[],
  tailored_resume       TEXT,
  tailored_cover_letter TEXT,
  is_hidden             BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_job_matches_user_score ON job_matches(user_id, overall_score DESC);

-- ─── Applications ────────────────────────────────────────────
CREATE TABLE applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id),
  match_id        UUID REFERENCES job_matches(id),
  status          application_status DEFAULT 'pending',
  applied_at      TIMESTAMPTZ,
  follow_up_at    TIMESTAMPTZ,
  interview_at    TIMESTAMPTZ,
  offer_at        TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  notes           TEXT,
  cover_letter    TEXT,
  resume_version  TEXT,
  auto_applied    BOOLEAN DEFAULT FALSE,
  bot_log         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user_status ON applications(user_id, status);
CREATE INDEX idx_applications_applied_at ON applications(applied_at DESC);

-- ─── Recruiters ──────────────────────────────────────────────
CREATE TABLE recruiters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID REFERENCES jobs(id),
  company     TEXT NOT NULL,
  name        TEXT,
  title       TEXT,
  email       TEXT,
  linkedin    TEXT,
  source      TEXT,
  verified    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recruiters_company ON recruiters(company);

-- ─── Emails ──────────────────────────────────────���───────────
CREATE TABLE emails (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES applications(id),
  recruiter_id    UUID REFERENCES recruiters(id),
  to_email        TEXT NOT NULL,
  to_name         TEXT,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL,  -- cold_outreach | follow_up | thank_you
  status          email_status DEFAULT 'queued',
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  provider_id     TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_user ON emails(user_id, created_at DESC);
CREATE INDEX idx_emails_status ON emails(status);

-- ─── Interview Prep ──────────────────────────────────────────
CREATE TABLE interview_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES applications(id),
  job_id          UUID REFERENCES jobs(id),
  company         TEXT,
  role            TEXT,
  questions       JSONB,  -- [{type, question, suggested_answer, tips}]
  notes           TEXT,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit / Activity Log ────────────────────────────────────
CREATE TABLE activity_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  description TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);

-- ─── Updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_resumes_updated_at
  BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_interview_sessions_updated_at
  BEFORE UPDATE ON interview_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
