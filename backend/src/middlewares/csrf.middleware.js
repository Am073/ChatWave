const crypto = require('crypto');

// Generate a random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Set token in non-HttpOnly cookie
const setCsrfCookie = (res, token) => {
  res.cookie('csrf_token', token, {
    httpOnly: false, // JS needs to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
};

const csrfProtection = (req, res, next) => {
  const method = req.method;
  
  // Skip CSRF validation for safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies.csrf_token;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch or missing' });
  }

  next();
};

module.exports = {
  csrfProtection,
  generateToken,
  setCsrfCookie
};
