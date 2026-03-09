const jwt = require('jsonwebtoken');
const { error } = require('../utils/helpers');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Unauthorized — missing token', 401);
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return error(res, 'Unauthorized — invalid or expired token', 401);
  }
}

module.exports = { authenticate };
