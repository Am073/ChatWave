const express = require('express');
const announcementsController = require('../controllers/announcements.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { standardLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

router.use(standardLimiter);

router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'faculty'),
  csrfProtection,
  announcementsController.createAnnouncement
);

router.get(
  '/',
  authMiddleware,
  announcementsController.getAnnouncements
);

router.put(
  '/:id/read',
  authMiddleware,
  csrfProtection,
  announcementsController.markAsRead
);

router.delete(
  '/:id',
  authMiddleware,
  csrfProtection,
  announcementsController.deleteAnnouncement
);

module.exports = router;
