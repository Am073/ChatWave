const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { strictLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

// Apply strict rate limiter to all auth mutations/requests
router.post('/register', strictLimiter, csrfProtection, authController.register);
router.post('/login', strictLimiter, csrfProtection, authController.login);
router.post('/logout', authMiddleware, csrfProtection, authController.logout);
router.post('/refresh', strictLimiter, authController.refresh);
router.post('/change-password', strictLimiter, authMiddleware, csrfProtection, authController.changePassword);

router.get('/csrf-token', authController.getCsrfToken);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
