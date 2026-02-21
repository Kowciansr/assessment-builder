const express = require('express');
const multer = require('multer');
const router = express.Router();

const qc = require('../controllers/questionController');
const ec = require('../controllers/exportController');
const { validateGeneration, validateUpdate } = require('../middleware/validation');

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  },
});

// ---- File upload endpoint ----
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const content = req.file.buffer.toString('utf-8').trim();
  if (!content) return res.status(400).json({ success: false, error: 'File is empty' });
  res.json({ success: true, content });
});

// ---- Question Generation ----
router.post('/questions/generate', validateGeneration, qc.generateQuestions);

// ---- Session questions ----
router.get('/sessions/:sessionId/questions', qc.getSessionQuestions);

// ---- Question operations ----
router.put('/questions/:id', validateUpdate, qc.updateQuestion);
router.delete('/questions/:id', qc.deleteQuestion);
router.post('/questions/:id/regenerate', qc.regenerateQuestion);
router.post('/questions/:id/validate', qc.validateQuestion);
router.post('/questions/:id/improve-distractors', qc.improveDistractors);
router.post('/questions/:id/increase-level', qc.increaseCognitiveLevel);
router.post('/questions/:id/save', qc.saveToBank);

// ---- Question Bank ----
router.get('/bank', qc.getQuestionBank);

// ---- Export ----
router.post('/export', ec.exportQuestions);

module.exports = router;
