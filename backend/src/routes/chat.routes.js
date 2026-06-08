const express = require('express');
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { standardLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

// Apply standard API rate limiter
router.use(standardLimiter);

router.post('/', authMiddleware, csrfProtection, chatController.sendMessage);
router.get('/history', authMiddleware, chatController.getHistory);
router.delete('/history', authMiddleware, csrfProtection, chatController.clearHistory);

module.exports = router;
