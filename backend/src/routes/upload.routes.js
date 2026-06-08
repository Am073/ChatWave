const express = require('express');
const uploadController = require('../controllers/upload.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { standardLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

// Apply standard API rate limiter
router.use(standardLimiter);

router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'faculty'),
  upload.single('file'),
  csrfProtection,
  uploadController.uploadDocument
);

router.get(
  '/status/:documentId',
  authMiddleware,
  uploadController.getDocumentStatus
);

router.get(
  '/list',
  authMiddleware,
  uploadController.listDocuments
);

router.delete(
  '/:documentId',
  authMiddleware,
  requireRole('admin', 'faculty'),
  csrfProtection,
  uploadController.deleteDocument
);

module.exports = router;
