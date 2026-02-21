# 📐 Assessment Builder — AI-Powered Internal Tool

> Reduce assessment creation time by 50% for instructional designers.

---

## Table of Contents
1. [Architecture Overview](#architecture)
2. [Folder Structure](#folder-structure)
3. [Database Schema](#database-schema)
4. [AI Engine Design](#ai-engine-design)
5. [Question JSON Schema](#question-json-schema)
6. [QA Validator Design](#qa-validator-design)
7. [Environment Setup](#environment-setup)
8. [Local Deployment](#local-deployment)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                   │
│  BuilderPage         BankPage                                   │
│  ┌────────────────┐  ┌──────────────────────────────────────┐   │
│  │ ContentInput   │  │ Filter / Search bar                  │   │
│  │ GenControls    │  │ QuestionCard (view/edit/QA)           │   │
│  │ QuestionCard   │  │ ExportPanel                          │   │
│  │ ExportPanel    │  └──────────────────────────────────────┘   │
│  └────────────────┘                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (Axios → /api/*)
                             │ Vite proxy → localhost:3001
┌────────────────────────────▼────────────────────────────────────┐
│                         BACKEND (Node/Express)                  │
│  Routes → Controllers → Services                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ routes/api.js        → all REST endpoints               │   │
│  │ controllers/question → business logic & DB ops          │   │
│  │ controllers/export   → file generation                  │   │
│  │ services/aiService   → OpenAI integration               │   │
│  │ services/exportService → CSV, DOCX, JSON export         │   │
│  │ middleware/validation → express-validator rules         │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
              ┌──────────────▼──────────────┐
              │   SQLite (better-sqlite3)   │
              │   db/assessment_builder.db  │
              └─────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     OpenAI API (GPT-4o)     │
              │   JSON response_format      │
              └─────────────────────────────┘
```

### Data Flow

1. **Generate**: User pastes content + objectives → selects type/level/difficulty/count → POST `/api/questions/generate` → AI service creates prompt → OpenAI returns JSON array → persisted to SQLite → returned to UI
2. **Edit/QA**: Per-question actions call dedicated endpoints → AI service or direct DB update → UI receives updated question object
3. **Bank**: Questions flagged `is_saved=1` → surfaced in Bank page with filter/search
4. **Export**: POST `/api/export` with question IDs and format → exportService generates file → streamed as download

---

## 2. Folder Structure

```
assessment-builder/
├── backend/
│   ├── server.js                    # Express entry point
│   ├── .env.example                 # Environment template
│   ├── package.json
│   ├── db/
│   │   └── schema.js                # SQLite init + table creation
│   ├── routes/
│   │   └── api.js                   # All REST routes
│   ├── controllers/
│   │   ├── questionController.js    # Generate, edit, QA, bank
│   │   └── exportController.js      # CSV, DOCX, JSON export
│   ├── services/
│   │   ├── aiService.js             # OpenAI integration + all prompts
│   │   └── exportService.js         # File generation logic
│   └── middleware/
│       └── validation.js            # Input validation rules
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx                 # React entry
        ├── App.jsx                  # Router + layout
        ├── index.css                # Global design system
        ├── services/
        │   └── api.js               # Axios API calls
        ├── utils/
        │   └── helpers.js           # Constants, utilities
        ├── pages/
        │   ├── BuilderPage.jsx      # Main generation UI
        │   └── BankPage.jsx         # Question bank browser
        └── components/
            ├── ContentInput/
            │   └── ContentInput.jsx
            ├── Generator/
            │   └── GenerationControls.jsx
            ├── Editor/
            │   └── QuestionCard.jsx  # Full card with edit/QA
            └── Export/
                └── ExportPanel.jsx
```

---

## 3. Database Schema

### `sessions` table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- UUID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  lesson_content TEXT,           -- Full pasted/uploaded content
  learning_objectives TEXT,      -- Raw objectives text
  generation_config TEXT         -- JSON: {questionType, bloomsLevel, difficulty, count}
);
```

### `questions` table
```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,           -- UUID
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,   -- mcq | true_false | scenario | case_based
  correct_answer TEXT NOT NULL,
  distractor_1 TEXT,             -- NULL for true/false
  distractor_2 TEXT,
  distractor_3 TEXT,
  explanation TEXT,
  blooms_level TEXT NOT NULL,    -- remember | understand | apply | analyze | evaluate | create
  difficulty TEXT NOT NULL,      -- easy | medium | hard
  objective_alignment TEXT,
  confidence_score REAL,         -- 1-10, assigned by AI at generation
  qa_score REAL,                 -- 1-10, assigned by QA validator
  qa_feedback TEXT,              -- JSON: full QA report object
  is_saved INTEGER DEFAULT 0,    -- 0=draft, 1=in question bank
  tags TEXT,                     -- JSON array e.g. ["biology","chapter-3"]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_questions_saved ON questions(is_saved);
CREATE INDEX idx_questions_type ON questions(question_type);
CREATE INDEX idx_questions_blooms ON questions(blooms_level);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_session ON questions(session_id);
```

---

## 4. AI Engine Design

### Generation Prompt Strategy

The system uses a **two-layer prompting approach**:

**System prompt** sets the expert persona, strict anti-hallucination rules, and output format requirements. Key rules enforced:
- All content must come ONLY from provided lesson text
- One unambiguous correct answer
- Distractors = plausible misconceptions, not tricks

**User prompt** is dynamically built with:
- Full lesson content (anti-hallucination anchor)
- Learning objectives
- Question type with specific instructions
- Bloom's level with matching verbs
- Difficulty calibration guide
- Distractor quality rules
- Explicit JSON schema

**`response_format: { type: 'json_object' }`** is always used to guarantee parseable output.

### QA Validator Approach

The validator calls GPT-4o with `temperature: 0.2` (low creativity = consistent scoring) and evaluates 8 dimensions:
1. Objective alignment
2. Bloom's consistency (verb matching)
3. Single correct answer integrity
4. Distractor plausibility
5. Clarity and ambiguity
6. Bias detection
7. Grammar
8. Content accuracy

Returns structured JSON with per-check pass/fail, scores, feedback, and suggested improvements.

### Other AI Operations

| Operation | Prompt Goal |
|-----------|-------------|
| Improve Distractors | Replace with common misconceptions, parallel form |
| Increase Cognitive Level | Rewrite entire question at next Bloom's level |
| Regenerate | Fresh question same params, different angle |

---

## 5. Question JSON Schema

The LMS-ready JSON export uses this schema:

```json
{
  "schema_version": "1.0",
  "export_date": "2024-01-15T10:30:00Z",
  "total_questions": 5,
  "questions": [
    {
      "id": "uuid-string",
      "sequence": 1,
      "type": "mcq",
      "stem": "Which process converts glucose into ATP in the absence of oxygen?",
      "options": [
        { "id": "A", "text": "Aerobic respiration", "correct": false },
        { "id": "B", "text": "Anaerobic glycolysis", "correct": true },
        { "id": "C", "text": "Photosynthesis", "correct": false },
        { "id": "D", "text": "The Calvin cycle", "correct": false }
      ],
      "explanation": "Anaerobic glycolysis occurs in the cytoplasm without oxygen. Aerobic respiration requires oxygen...",
      "metadata": {
        "blooms_level": "understand",
        "difficulty": "medium",
        "objective_alignment": "Learner can explain cellular respiration pathways",
        "confidence_score": 8.5,
        "qa_score": 9.0,
        "tags": ["biology", "cellular-respiration"]
      }
    }
  ]
}
```

---

## 6. QA Validator Design

### Scoring Weights (for manual review guidance)

| Check | Weight | Fail Threshold |
|-------|--------|---------------|
| Single correct answer | 25% | Any ambiguity = fail |
| Bloom's consistency | 20% | Wrong verb family = fail |
| Objective alignment | 20% | Unrelated = fail |
| Distractor plausibility | 20% | Obvious wrong answers = warning |
| Clarity | 10% | Double negatives = warning |
| Bias detection | 5% | Any bias = fail |

### Severity Levels

- **pass**: All critical checks pass, QA score ≥ 7
- **warning**: Minor issues, QA score 5-6
- **fail**: Critical check failed OR QA score < 5

---

## 7. API Endpoints Reference

```
POST   /api/upload                           Upload .txt file → returns content string
POST   /api/questions/generate               Generate questions from content
GET    /api/sessions/:sessionId/questions    Get questions for a session
PUT    /api/questions/:id                    Inline edit a question
DELETE /api/questions/:id                    Delete a question
POST   /api/questions/:id/regenerate         Regenerate single question
POST   /api/questions/:id/validate           Run QA validator
POST   /api/questions/:id/improve-distractors Improve distractors via AI
POST   /api/questions/:id/increase-level     Raise Bloom's level
POST   /api/questions/:id/save               Save to question bank
GET    /api/bank                             Get saved questions (with filters)
POST   /api/export                           Export as CSV/DOCX/JSON
GET    /health                               Health check
```

---

## 8. Environment Setup

### Backend `.env`
```bash
# Copy from .env.example
cp backend/.env.example backend/.env

# Required values:
OPENAI_API_KEY=sk-...          # Your OpenAI API key
OPENAI_MODEL=gpt-4o            # Recommended: gpt-4o for best quality
PORT=3001
NODE_ENV=development
DB_PATH=./db/assessment_builder.db
MAX_FILE_SIZE_MB=10
```

---

## 9. Local Deployment Instructions

### Prerequisites
- Node.js 18+
- npm 9+
- OpenAI API key with GPT-4o access

### Step 1 — Backend

```bash
cd assessment-builder/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start backend (dev mode with auto-reload)
npm run dev

# OR production start
npm start

# Backend runs at: http://localhost:3001
# SQLite database auto-created at: ./db/assessment_builder.db
```

### Step 2 — Frontend

```bash
cd assessment-builder/frontend

# Install dependencies
npm install

# Start dev server (proxies /api to localhost:3001)
npm run dev

# App runs at: http://localhost:5173
```

### Step 3 — Production Build

```bash
# Build frontend static files
cd frontend && npm run build

# Serve static files from backend (add to server.js):
# app.use(express.static(path.join(__dirname, '../frontend/dist')));
# app.get('*', (req,res) => res.sendFile(path.join(__dirname,'../frontend/dist/index.html')));

# Then run only backend:
cd backend && npm start
```

### Verify Setup

1. Open http://localhost:5173
2. Click "Health" or visit http://localhost:3001/health
3. Paste sample content → configure generation → click Generate
4. Verify questions appear with correct structure
5. Test QA Validator, export functions

### Recommended System Prompt Testing

Test with 3-5 sentences of lesson content + 2 clear objectives before going live.
Adjust `temperature` in `aiService.js` if outputs are too creative (lower) or too repetitive (higher).

---

## Quality Notes

- **Anti-hallucination**: The system prompt explicitly anchors all generation to the provided content. The model is instructed not to introduce external facts. For highest fidelity, provide detailed lesson content.
- **Bloom's alignment**: The prompt provides level-specific verb lists. QA validator cross-checks whether the question verb matches the tagged level.
- **Distractor quality**: Three-stage approach: AI generates → human can edit inline → "Improve Distractors" re-runs AI specifically focused on misconception quality.
- **No multi-tenant**: This is single-org internal use. No auth system included — add LDAP/SSO middleware if needed.
