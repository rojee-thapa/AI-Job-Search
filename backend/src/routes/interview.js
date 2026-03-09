const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  createInterviewSession,
  getInterviewSession,
  listInterviewSessions,
  evaluateAnswer,
  scheduleInterview,
} = require('../controllers/interviewController');

const router = Router();

router.use(authenticate);

router.get('/', listInterviewSessions);
router.post('/', createInterviewSession);
router.get('/:id', getInterviewSession);
router.post('/evaluate', evaluateAnswer);
router.post('/schedule', scheduleInterview);

module.exports = router;
