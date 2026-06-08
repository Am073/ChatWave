const express = require('express');
const calendarController = require('../controllers/calendar.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { standardLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

router.use(standardLimiter);

router.get('/auth', authMiddleware, calendarController.getAuthUrl);
router.get('/callback', calendarController.oauthCallback);
router.post('/sync', authMiddleware, csrfProtection, calendarController.syncEvent);
router.get('/events', authMiddleware, calendarController.getEvents);
router.get('/status', authMiddleware, calendarController.getStatus);

module.exports = router;
