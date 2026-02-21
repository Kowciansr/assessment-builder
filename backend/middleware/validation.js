const { body, validationResult } = require('express-validator');

const QUESTION_TYPES = ['mcq', 'true_false', 'scenario', 'case_based'];
const BLOOMS_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

const validateGeneration = [
  body('content').trim().notEmpty().withMessage('Lesson content is required').isLength({ max: 20000 }),
  body('objectives').trim().notEmpty().withMessage('Learning objectives are required').isLength({ max: 5000 }),
  body('questionType').isIn(QUESTION_TYPES).withMessage(`questionType must be one of: ${QUESTION_TYPES.join(', ')}`),
  body('bloomsLevel').isIn(BLOOMS_LEVELS).withMessage(`bloomsLevel must be one of: ${BLOOMS_LEVELS.join(', ')}`),
  body('difficulty').isIn(DIFFICULTIES).withMessage(`difficulty must be one of: ${DIFFICULTIES.join(', ')}`),
  body('count').isInt({ min: 1, max: 20 }).withMessage('count must be an integer between 1 and 20'),
  handleValidationErrors,
];

const validateUpdate = [
  body('blooms_level').optional().isIn(BLOOMS_LEVELS),
  body('difficulty').optional().isIn(DIFFICULTIES),
  body('question_text').optional().trim().notEmpty(),
  body('correct_answer').optional().trim().notEmpty(),
  handleValidationErrors,
];

module.exports = { validateGeneration, validateUpdate, handleValidationErrors };
