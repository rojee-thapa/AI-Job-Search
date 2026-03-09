const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadResume, getResume, getImprovementTips, tailorResume } = require('../controllers/resumeController');

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('resume'), uploadResume);
router.get('/', getResume);
router.get('/tips', getImprovementTips);
router.post('/tailor', tailorResume);

module.exports = router;
