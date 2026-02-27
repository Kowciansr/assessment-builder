const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const aiService = require('../services/aiService');

// Helper to parse JSON fields from DB rows
function safeJsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value; // already parsed
  if (value.trim() === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('Failed to parse JSON:', value, e.message);
    return fallback;
  }
}

function parseQuestion(row) {
  if (!row) return null;
  return {
    ...row,
    tags: safeJsonParse(row.tags, []),
    qa_feedback: safeJsonParse(row.qa_feedback, null),
  };
}

// ============================================================
// GENERATE QUESTIONS
// ============================================================
async function generateQuestions(req, res) {
  try {
    const {
      content,
      objectives,
      questionType,
      bloomsLevel,
      difficulty,
      count,
      tags = [],
    } = req.body;

    // Create session
    const sessionId = uuidv4();
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, lesson_content, learning_objectives, generation_config)
      VALUES (?, ?, ?, ?)
    `);
    insertSession.run(
      sessionId,
      content,
      objectives,
      JSON.stringify({ questionType, bloomsLevel, difficulty, count })
    );

    // Generate via AI
    const aiQuestions = await aiService.generateQuestions({
      content,
      objectives,
      questionType,
      bloomsLevel,
      difficulty,
      count: parseInt(count, 10),
    });

    // Persist each question
    const insertQ = db.prepare(`
      INSERT INTO questions (id, session_id, question_text, question_type, correct_answer,
        distractor_1, distractor_2, distractor_3, explanation, blooms_level, difficulty,
        objective_alignment, confidence_score, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const savedQuestions = aiQuestions.map((q) => {
      const id = uuidv4();
      insertQ.run(
        id,
        sessionId,
        q.question_text,
        q.question_type || questionType,
        q.correct_answer,
        q.distractor_1 || null,
        q.distractor_2 || null,
        q.distractor_3 || null,
        q.explanation,
        q.blooms_level || bloomsLevel,
        q.difficulty || difficulty,
        q.objective_alignment || null,
        q.confidence_score || null,
        JSON.stringify(tags)
      );
      return parseQuestion({ id, session_id: sessionId, ...q, tags, qa_feedback: null, is_saved: 0 });
    });

    res.json({ success: true, session_id: sessionId, questions: savedQuestions });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// REGENERATE SINGLE QUESTION
// ============================================================
async function regenerateQuestion(req, res) {
  try {
    const { id } = req.params;
    const { content, objectives } = req.body;

    const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Question not found' });

    const session = existing.session_id
      ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(existing.session_id)
      : null;

    const newQ = await aiService.regenerateSingleQuestion({
      content: content || (session ? session.lesson_content : ''),
      objectives: objectives || (session ? session.learning_objectives : ''),
      questionType: existing.question_type,
      bloomsLevel: existing.blooms_level,
      difficulty: existing.difficulty,
    });

    db.prepare(`
      UPDATE questions SET question_text=?, correct_answer=?, distractor_1=?, distractor_2=?,
        distractor_3=?, explanation=?, objective_alignment=?, confidence_score=?, qa_score=null, qa_feedback=null
      WHERE id=?
    `).run(
      newQ.question_text, newQ.correct_answer, newQ.distractor_1 || null,
      newQ.distractor_2 || null, newQ.distractor_3 || null, newQ.explanation,
      newQ.objective_alignment || null, newQ.confidence_score || null, id
    );

    const updated = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    res.json({ success: true, question: updated });
  } catch (error) {
    console.error('Regenerate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// UPDATE QUESTION (inline edit)
// ============================================================
function updateQuestion(req, res) {
  try {
    const { id } = req.params;
    const {
      question_text, correct_answer, distractor_1, distractor_2, distractor_3,
      explanation, blooms_level, difficulty, objective_alignment, tags,
    } = req.body;

    const existing = db.prepare('SELECT id FROM questions WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Question not found' });

    db.prepare(`
      UPDATE questions SET
        question_text=COALESCE(?,question_text),
        correct_answer=COALESCE(?,correct_answer),
        distractor_1=COALESCE(?,distractor_1),
        distractor_2=COALESCE(?,distractor_2),
        distractor_3=COALESCE(?,distractor_3),
        explanation=COALESCE(?,explanation),
        blooms_level=COALESCE(?,blooms_level),
        difficulty=COALESCE(?,difficulty),
        objective_alignment=COALESCE(?,objective_alignment),
        tags=COALESCE(?,tags)
      WHERE id=?
    `).run(
      question_text, correct_answer, distractor_1, distractor_2, distractor_3,
      explanation, blooms_level, difficulty, objective_alignment,
      tags ? JSON.stringify(tags) : undefined,
      id
    );

    const updated = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    res.json({ success: true, question: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// DELETE QUESTION
// ============================================================
function deleteQuestion(req, res) {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM questions WHERE id=?').run(id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Question not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// QA VALIDATE QUESTION
// ============================================================
async function validateQuestion(req, res) {
  try {
    const { id } = req.params;
    const { content, objectives } = req.body;

    const question = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    const session = question.session_id
      ? db.prepare('SELECT * FROM sessions WHERE id=?').get(question.session_id)
      : null;

    const qaResult = await aiService.validateQuestion(
      question,
      content || (session ? session.lesson_content : ''),
      objectives || (session ? session.learning_objectives : '')
    );

    // Update question with QA results
    db.prepare('UPDATE questions SET qa_score=?, qa_feedback=? WHERE id=?').run(
      qaResult.qa_score,
      JSON.stringify(qaResult),
      id
    );

    res.json({ success: true, qa_result: qaResult, qa_score: qaResult.qa_score });
  } catch (error) {
    console.error('QA error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// IMPROVE DISTRACTORS
// ============================================================
async function improveDistractors(req, res) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const question = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    const session = question.session_id
      ? db.prepare('SELECT * FROM sessions WHERE id=?').get(question.session_id)
      : null;

    const improved = await aiService.improveDistractors(
      question,
      content || (session ? session.lesson_content : '')
    );

    db.prepare(`
      UPDATE questions SET distractor_1=?, distractor_2=?, distractor_3=? WHERE id=?
    `).run(improved.distractor_1, improved.distractor_2, improved.distractor_3, id);

    const updated = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    res.json({ success: true, question: updated, rationale: improved.rationale });
  } catch (error) {
    console.error('Distractor improve error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// INCREASE COGNITIVE LEVEL
// ============================================================
async function increaseCognitiveLevel(req, res) {
  try {
    const { id } = req.params;

    const question = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    const improved = await aiService.increaseCognitiveLevel(question);

    db.prepare(`
      UPDATE questions SET question_text=?, correct_answer=?, distractor_1=?, distractor_2=?,
        distractor_3=?, explanation=?, blooms_level=?, objective_alignment=?, confidence_score=?,
        qa_score=null, qa_feedback=null
      WHERE id=?
    `).run(
      improved.question_text, improved.correct_answer, improved.distractor_1,
      improved.distractor_2, improved.distractor_3, improved.explanation,
      improved.blooms_level, improved.objective_alignment, improved.confidence_score, id
    );

    const updated = parseQuestion(db.prepare('SELECT * FROM questions WHERE id=?').get(id));
    res.json({ success: true, question: updated });
  } catch (error) {
    console.error('Cognitive level error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// SAVE TO QUESTION BANK
// ============================================================
function saveToBank(req, res) {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    const existing = db.prepare('SELECT id FROM questions WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Question not found' });

    db.prepare('UPDATE questions SET is_saved=1, tags=COALESCE(?,tags) WHERE id=?').run(
      tags ? JSON.stringify(tags) : null,
      id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// GET QUESTION BANK (saved questions with filters)
// ============================================================
function getQuestionBank(req, res) {
  try {
    const {
      search = '',
      blooms_level,
      difficulty,
      question_type,
      tag,
      page = 1,
      limit = 20,
    } = req.query;

    let conditions = ['is_saved = 1'];
    const params = [];

    if (search) {
      conditions.push('(question_text LIKE ? OR explanation LIKE ? OR objective_alignment LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (blooms_level) { conditions.push('blooms_level = ?'); params.push(blooms_level); }
    if (difficulty) { conditions.push('difficulty = ?'); params.push(difficulty); }
    if (question_type) { conditions.push('question_type = ?'); params.push(question_type); }
    if (tag) { conditions.push('tags LIKE ?'); params.push(`%"${tag}"%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const total = db.prepare(`SELECT COUNT(*) as count FROM questions ${where}`).get(...params).count;
    const questions = db
      .prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit, 10), offset)
      .map(parseQuestion);

    res.json({ success: true, questions, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// GET SESSION QUESTIONS
// ============================================================
function getSessionQuestions(req, res) {
  try {
    const { sessionId } = req.params;
    const questions = db
      .prepare('SELECT * FROM questions WHERE session_id=? ORDER BY created_at ASC')
      .all(sessionId)
      .map(parseQuestion);
    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  generateQuestions,
  regenerateQuestion,
  updateQuestion,
  deleteQuestion,
  validateQuestion,
  improveDistractors,
  increaseCognitiveLevel,
  saveToBank,
  getQuestionBank,
  getSessionQuestions,
};
