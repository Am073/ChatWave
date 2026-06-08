const rateLimit = require('express-rate-limit');

let strictLimiter, standardLimiter;

const isProd = process.env.NODE_ENV === 'production';

if (process.env.NODE_ENV === 'test') {
  strictLimiter = (req, res, next) => next();
  standardLimiter = (req, res, next) => next();
} else {
  // Strict rate limiter for auth routes (100 requests in dev, 15 in prod)
  strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProd ? 15 : 100,
    message: { error: 'Too many authentication attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Standard rate limiter for general API routes (1000 requests in dev, 100 in prod)
  standardLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isProd ? 100 : 1000,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = {
  strictLimiter,
  standardLimiter
};
