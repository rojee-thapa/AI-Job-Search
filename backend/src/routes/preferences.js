const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { success, error } = require('../utils/helpers');

const router = Router();

router.use(authenticate);

// pg doesn't auto-parse custom enum arrays — they come back as "{val1,val2}" strings
function parseEnumArrays(row) {
  if (!row) return row;
  ['employment_types', 'work_modes'].forEach((key) => {
    if (typeof row[key] === 'string') {
      row[key] = row[key].replace(/^\{|\}$/g, '').split(',').filter(Boolean);
    }
  });
  return row;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id],
    );
    if (!result.rows.length) return error(res, 'Preferences not found', 404);
    return success(res, parseEnumArrays(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      target_roles, preferred_locations, remote_ok, min_salary, max_salary,
      visa_status, requires_sponsorship, years_experience, excluded_companies,
      daily_application_limit, auto_apply_enabled, min_match_score, alert_email, alert_hour,
      // New fields (migration 002)
      role_seniority, degree_required, degree_subjects,
    } = req.body;

    // Normalize enum arrays — frontend may send "{val1,val2}" strings if state was corrupted
    const normalizeArray = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
      return [];
    };
    const employment_types = normalizeArray(req.body.employment_types);
    const work_modes = normalizeArray(req.body.work_modes);

    const result = await query(
      `INSERT INTO user_preferences (
         user_id, target_roles, preferred_locations, remote_ok, min_salary, max_salary,
         visa_status, requires_sponsorship, years_experience, employment_types, work_modes,
         excluded_companies, daily_application_limit, auto_apply_enabled,
         min_match_score, alert_email, alert_hour,
         role_seniority, degree_required, degree_subjects
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (user_id) DO UPDATE SET
         target_roles = EXCLUDED.target_roles,
         preferred_locations = EXCLUDED.preferred_locations,
         remote_ok = EXCLUDED.remote_ok,
         min_salary = EXCLUDED.min_salary,
         max_salary = EXCLUDED.max_salary,
         visa_status = EXCLUDED.visa_status,
         requires_sponsorship = EXCLUDED.requires_sponsorship,
         years_experience = EXCLUDED.years_experience,
         employment_types = EXCLUDED.employment_types,
         work_modes = EXCLUDED.work_modes,
         excluded_companies = EXCLUDED.excluded_companies,
         daily_application_limit = EXCLUDED.daily_application_limit,
         auto_apply_enabled = EXCLUDED.auto_apply_enabled,
         min_match_score = EXCLUDED.min_match_score,
         alert_email = EXCLUDED.alert_email,
         alert_hour = EXCLUDED.alert_hour,
         role_seniority = EXCLUDED.role_seniority,
         degree_required = EXCLUDED.degree_required,
         degree_subjects = EXCLUDED.degree_subjects,
         updated_at = NOW()
       RETURNING *`,
      [
        userId, target_roles, preferred_locations, remote_ok, min_salary, max_salary,
        visa_status, requires_sponsorship, years_experience, employment_types, work_modes,
        excluded_companies, daily_application_limit, auto_apply_enabled,
        min_match_score, alert_email, alert_hour,
        normalizeArray(role_seniority), degree_required ?? false, normalizeArray(degree_subjects),
      ],
    );

    return success(res, parseEnumArrays(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
