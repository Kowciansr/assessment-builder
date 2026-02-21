const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './db/assessment_builder.db';

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeSchema() {
  db.exec(`
    -- Sessions: tracks generation runs
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      lesson_content TEXT,
      learning_objectives TEXT,
      generation_config TEXT -- JSON: question_types, bloom_levels, difficulty, count
    );

    -- Questions: core table for all generated/saved questions
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('mcq','true_false','scenario','case_based')),
      correct_answer TEXT NOT NULL,
      distractor_1 TEXT,
      distractor_2 TEXT,
      distractor_3 TEXT,
      explanation TEXT,
      blooms_level TEXT NOT NULL CHECK(blooms_level IN ('remember','understand','apply','analyze','evaluate','create')),
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
      objective_alignment TEXT,
      confidence_score REAL CHECK(confidence_score >= 1 AND confidence_score <= 10),
      qa_score REAL CHECK(qa_score >= 1 AND qa_score <= 10),
      qa_feedback TEXT, -- JSON array of feedback items
      is_saved INTEGER DEFAULT 0, -- 0=draft, 1=saved to bank
      tags TEXT, -- JSON array of topic tags
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_questions_saved ON questions(is_saved);
    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
    CREATE INDEX IF NOT EXISTS idx_questions_blooms ON questions(blooms_level);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
    CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at);

    -- Trigger to update updated_at
    CREATE TRIGGER IF NOT EXISTS questions_updated_at
      AFTER UPDATE ON questions
      BEGIN
        UPDATE questions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);
}

initializeSchema();

module.exports = db;
