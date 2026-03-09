const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { generateAndSendOutreach, findRecruiter, getEmails, sendFollowUps, getEmailStats } = require('../controllers/emailController');

const router = Router();

router.use(authenticate);

router.post('/outreach', generateAndSendOutreach);
router.get('/recruiter-hint', findRecruiter);
router.get('/', getEmails);
router.post('/follow-ups', sendFollowUps);
router.get('/stats', getEmailStats);

module.exports = router;
