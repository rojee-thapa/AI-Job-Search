const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

async function register(req, res, next) {
  try {
    const { email, password, full_name } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return error(res, 'Email already registered', 409);

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1,$2,$3) RETURNING id, email, full_name, created_at',
      [email, hash, full_name],
    );

    // Create default preferences record
    await query(
      'INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [result.rows[0].id],
    );

    const token = signToken(result.rows[0].id);
    return success(res, { token, user: result.rows[0] }, 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, full_name, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );

    if (!result.rows.length) return error(res, 'Invalid credentials', 401);

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return error(res, 'Invalid credentials', 401);

    const token = signToken(user.id);
    const { password_hash, ...safeUser } = user;
    return success(res, { token, user: safeUser });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.created_at, p.*
       FROM users u
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id],
    );

    if (!result.rows.length) return error(res, 'User not found', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { register, login, getProfile };
