const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');
const { standardLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

router.use(standardLimiter);
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/stats', adminController.getStats);
router.get('/activity', adminController.getActivity);
router.get('/health', adminController.getHealth);
router.get('/users', adminController.getUsers);
router.post('/users', csrfProtection, adminController.createUser);
router.put('/users/:id', csrfProtection, adminController.updateUser);
router.delete('/users/:id', csrfProtection, adminController.deleteUser);
router.get('/documents', adminController.getDocuments);
router.delete('/documents/:id', csrfProtection, adminController.deleteDocument);
router.post('/seed', csrfProtection, adminController.triggerSeed);

module.exports = router;
