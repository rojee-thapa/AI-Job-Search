const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  discoverJobs, getMatchedJobs, getJobById,
  hideJob, saveJob, getSavedJobs, getJobStats,
} = require('../controllers/jobController');

const router = Router();

router.use(authenticate);

router.post('/discover', discoverJobs);
router.get('/saved', getSavedJobs);       // must come before /:id
router.get('/stats', getJobStats);
router.get('/', getMatchedJobs);
router.get('/:id', getJobById);
router.patch('/:id/hide', hideJob);
router.patch('/:id/save', saveJob);       // toggle save/unsave

module.exports = router;
