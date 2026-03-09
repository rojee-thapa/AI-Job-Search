/**
 * Clamp a numeric value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paginate an array.
 */
function paginate(array, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return {
    data: array.slice(offset, offset + limit),
    total: array.length,
    page,
    limit,
    totalPages: Math.ceil(array.length / limit),
  };
}

/**
 * Parse salary string like "$80k-$120k" into {min, max}.
 */
function parseSalary(str) {
  if (!str) return { min: null, max: null };
  const clean = str.replace(/[,$]/g, '').toLowerCase();
  const kMult = (s) => (s.includes('k') ? parseFloat(s) * 1000 : parseFloat(s));
  const range = clean.match(/([\d.]+k?)[\s\-–]+([\d.]+k?)/);
  if (range) return { min: kMult(range[1]), max: kMult(range[2]) };
  const single = clean.match(/([\d.]+k?)/);
  if (single) { const v = kMult(single[1]); return { min: v, max: v }; }
  return { min: null, max: null };
}

/**
 * Normalise a URL — ensure it has a scheme.
 */
function normaliseUrl(url) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

/**
 * Safely parse JSON, returning a default if it fails.
 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Build a standardised API success response.
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

/**
 * Build a standardised API error response.
 */
function error(res, message, statusCode = 400, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { clamp, sleep, paginate, parseSalary, normaliseUrl, safeJsonParse, success, error };
