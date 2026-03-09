-- ============================================================
-- Migration 002: Add Features
-- - Extend user_preferences with seniority & degree fields
-- - Add is_saved flag to job_matches
-- - Add company_research JSONB to jobs
-- ============================================================

-- ─── User Preferences: new matching fields ───────────────────
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS role_seniority   TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS degree_required  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS degree_subjects  TEXT[]  DEFAULT '{}';

-- ─── Job Matches: save flag ──────────────────────────────────
ALTER TABLE job_matches
  ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT FALSE;

-- ─── Jobs: AI-generated company research ─────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_research JSONB;
