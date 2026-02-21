const db = require('../db/schema');
const { exportToCSV, exportToJSON, exportToDocx } = require('../services/exportService');

function parseQuestion(row) {
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    qa_feedback: row.qa_feedback ? JSON.parse(row.qa_feedback) : null,
  };
}

function getQuestions(ids, bankOnly) {
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`).all(...ids).map(parseQuestion);
  }
  if (bankOnly) {
    return db.prepare('SELECT * FROM questions WHERE is_saved=1 ORDER BY created_at DESC').all().map(parseQuestion);
  }
  return [];
}

async function exportQuestions(req, res) {
  try {
    const { format, ids, bank_only } = req.body;

    if (!format || !['csv', 'json', 'docx'].includes(format)) {
      return res.status(400).json({ success: false, error: 'format must be csv, json, or docx' });
    }

    const questions = getQuestions(ids, bank_only);
    if (questions.length === 0) {
      return res.status(400).json({ success: false, error: 'No questions found to export' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csv = exportToCSV(questions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="questions_${timestamp}.csv"`);
      return res.send(csv);
    }

    if (format === 'json') {
      const json = exportToJSON(questions);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="questions_${timestamp}.json"`);
      return res.send(json);
    }

    if (format === 'docx') {
      const buffer = await exportToDocx(questions);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="questions_${timestamp}.docx"`);
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { exportQuestions };
