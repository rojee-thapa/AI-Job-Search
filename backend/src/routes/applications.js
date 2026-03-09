const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getApplications,
  createApplication,
  updateApplicationStatus,
  triggerAutoApply,
  getApplicationStats,
  syncToSheets,
} = require('../controllers/applicationController');

const router = Router();

router.use(authenticate);

router.get('/', getApplications);
router.get('/stats', getApplicationStats);
router.post('/', createApplication);
router.patch('/:id/status', updateApplicationStatus);
router.post('/auto-apply', triggerAutoApply);
router.post('/sync-sheets', syncToSheets);

module.exports = router;
