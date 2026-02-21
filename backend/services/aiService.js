const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ============================================================
// BLOOM'S TAXONOMY VERB MAP (used for validation)
// ============================================================
const BLOOMS_VERBS = {
  remember: ['recall', 'recognize', 'identify', 'list', 'name', 'define', 'state', 'match', 'label', 'describe'],
  understand: ['explain', 'summarize', 'paraphrase', 'classify', 'compare', 'interpret', 'illustrate', 'discuss'],
  apply: ['use', 'apply', 'demonstrate', 'solve', 'calculate', 'implement', 'execute', 'perform', 'operate'],
  analyze: ['analyze', 'differentiate', 'examine', 'break down', 'distinguish', 'organize', 'deconstruct', 'compare'],
  evaluate: ['evaluate', 'judge', 'justify', 'critique', 'assess', 'defend', 'prioritize', 'recommend', 'select'],
  create: ['design', 'create', 'develop', 'formulate', 'construct', 'plan', 'produce', 'compose', 'generate'],
};

// ============================================================
// SYSTEM PROMPT
// ============================================================
const GENERATION_SYSTEM_PROMPT = `You are an expert instructional designer and assessment specialist with deep knowledge of Bloom's Taxonomy, psychometrics, and educational measurement.

Your task is to generate high-quality assessment questions based on provided lesson content and learning objectives.

STRICT RULES:
1. BASE ALL QUESTIONS SOLELY on the provided lesson content — do not introduce external facts, invented scenarios, or information not present in the content.
2. Every question must have EXACTLY ONE unambiguously correct answer.
3. Distractors must be PLAUSIBLE (could fool someone who hasn't learned well) but CLEARLY INCORRECT to someone who has mastered the content.
4. Distractors must NOT be trick questions, nonsensical, obviously wrong, or "all of the above / none of the above."
5. Questions must align precisely with the specified Bloom's Taxonomy level — use verbs that match that cognitive level.
6. Match the difficulty calibration: Easy=recall/basic comprehension, Medium=application/analysis, Hard=synthesis/evaluation.
7. Avoid bias: no cultural, gender, age, or socioeconomic bias. Use neutral, professional language.
8. Questions must be grammatically correct, clear, and unambiguous. No double negatives.
9. For scenario/case-based questions: ground scenarios in realistic professional contexts relevant to the content.
10. Confidence score reflects: clarity (25%), bloom alignment (25%), distractor quality (25%), objective alignment (25%).

RESPONSE FORMAT: Return ONLY a valid JSON array. No markdown fences, no commentary, no preamble.`;

// ============================================================
// USER PROMPT TEMPLATE
// ============================================================
function buildGenerationPrompt({ content, objectives, questionType, bloomsLevel, difficulty, count }) {
  const typeInstructions = {
    mcq: 'Multiple Choice Question with exactly 4 options (1 correct + 3 distractors). Format correct_answer as the full text of the correct option.',
    true_false: 'True/False question. Provide the statement as question_text. correct_answer is "True" or "False". distractor_1 is the opposite. distractor_2 and distractor_3 are null.',
    scenario: 'Scenario-based question: Begin with a 2-3 sentence realistic workplace/professional scenario, then ask a specific question about what the learner should do or understand.',
    case_based: 'Case-based question: Present a detailed case (3-4 sentences) with multiple embedded facts from the content, then ask a complex analytical or evaluative question about the case.',
  };

  return `LESSON CONTENT:
${content}

LEARNING OBJECTIVES:
${objectives}

GENERATION PARAMETERS:
- Question Type: ${questionType} — ${typeInstructions[questionType]}
- Bloom's Taxonomy Level: ${bloomsLevel.toUpperCase()} — Use cognitive verbs appropriate for this level: ${BLOOMS_VERBS[bloomsLevel].join(', ')}
- Difficulty: ${difficulty.toUpperCase()}
- Number of Questions: ${count}

DISTRACTOR QUALITY RULES:
- Each distractor must represent a COMMON MISCONCEPTION or a PLAUSIBLE ALTERNATIVE that a learner who partially understands the content might choose.
- Distractors must be approximately the same length and grammatical form as the correct answer (avoid giveaway length differences).
- Distractors must NOT overlap in meaning with each other or the correct answer.
- Do not use "None of the above" or "All of the above" as distractors.

OUTPUT: Return a JSON array of ${count} question objects. Each object MUST follow this exact schema:
[
  {
    "question_text": "string — the full question",
    "question_type": "${questionType}",
    "correct_answer": "string — full text of correct answer",
    "distractor_1": "string or null",
    "distractor_2": "string or null",
    "distractor_3": "string or null",
    "explanation": "string — 2-3 sentences explaining why the correct answer is right and why key distractors are wrong",
    "blooms_level": "${bloomsLevel}",
    "difficulty": "${difficulty}",
    "objective_alignment": "string — 1 sentence describing which learning objective this question assesses and how",
    "confidence_score": number between 1 and 10
  }
]`;
}

// ============================================================
// QA VALIDATION SYSTEM PROMPT
// ============================================================
const QA_SYSTEM_PROMPT = `You are a psychometrician and assessment quality assurance specialist. Your role is to critically evaluate assessment questions for quality, validity, and pedagogical soundness.

Evaluate each question rigorously against all criteria. Be specific and actionable in your feedback.

RESPONSE FORMAT: Return ONLY a valid JSON object. No markdown, no commentary.`;

function buildQAPrompt(question, content, objectives) {
  return `Evaluate this assessment question against the provided lesson content and objectives.

ORIGINAL CONTENT:
${content || 'Not provided'}

LEARNING OBJECTIVES:
${objectives || 'Not provided'}

QUESTION TO EVALUATE:
${JSON.stringify(question, null, 2)}

Evaluate on ALL of the following criteria and return a JSON object:

{
  "qa_score": number 1-10 (overall quality score),
  "checks": {
    "objective_alignment": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "specific feedback"
    },
    "blooms_consistency": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Does the question verb and cognitive demand match the tagged Bloom's level?"
    },
    "single_correct_answer": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Is there exactly one unambiguously correct answer? Could any distractor also be argued as correct?"
    },
    "distractor_plausibility": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Are distractors plausible misconceptions? Are they parallel in form to the correct answer?"
    },
    "clarity": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Is the question clear, unambiguous, and free of double negatives or confusing phrasing?"
    },
    "bias_detection": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Any cultural, gender, racial, age, or socioeconomic bias detected?"
    },
    "grammar": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Grammar, spelling, punctuation issues if any"
    },
    "content_accuracy": {
      "pass": boolean,
      "score": number 1-10,
      "feedback": "Is the question and correct answer factually grounded in the provided content?"
    }
  },
  "suggested_improvements": ["array of specific, actionable improvement suggestions"],
  "revised_question_text": "improved version of the question text if needed, or null if no change needed",
  "severity": "pass|warning|fail"
}`;
}

// ============================================================
// DISTRACTOR IMPROVEMENT PROMPT
// ============================================================
function buildDistractorImprovementPrompt(question, content) {
  return `You are an assessment specialist. Improve the distractors for the following question.

LESSON CONTENT:
${content || 'Not provided'}

CURRENT QUESTION:
${JSON.stringify(question, null, 2)}

Create 3 improved distractors that:
1. Represent common misconceptions a learner might have about this content
2. Are parallel in length and grammatical form to the correct answer
3. Are clearly incorrect to someone who mastered the content
4. Are plausible to someone who hasn't mastered it
5. Do not overlap in meaning with each other

Return ONLY a JSON object:
{
  "distractor_1": "improved distractor",
  "distractor_2": "improved distractor",
  "distractor_3": "improved distractor",
  "rationale": "brief explanation of the improvement strategy"
}`;
}

// ============================================================
// COGNITIVE LEVEL INCREASE PROMPT
// ============================================================
const BLOOMS_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

function buildCognitiveLevelPrompt(question, targetLevel) {
  return `You are an instructional designer. Rewrite this question to target a HIGHER Bloom's Taxonomy cognitive level.

CURRENT QUESTION (Level: ${question.blooms_level}):
${JSON.stringify(question, null, 2)}

TARGET LEVEL: ${targetLevel.toUpperCase()}
Use cognitive verbs appropriate for ${targetLevel}: ${BLOOMS_VERBS[targetLevel].join(', ')}

Rewrite the question and all answer options to require the higher cognitive skill.
Maintain the same topic/content domain.

Return ONLY a JSON object with these fields:
{
  "question_text": "rewritten question",
  "correct_answer": "rewritten correct answer",
  "distractor_1": "rewritten distractor",
  "distractor_2": "rewritten distractor",
  "distractor_3": "rewritten distractor",
  "explanation": "updated explanation",
  "blooms_level": "${targetLevel}",
  "objective_alignment": "updated alignment note",
  "confidence_score": number
}`;
}

// ============================================================
// CORE AI FUNCTIONS
// ============================================================

async function generateQuestions({ content, objectives, questionType, bloomsLevel, difficulty, count }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: GENERATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildGenerationPrompt({ content, objectives, questionType, bloomsLevel, difficulty, count }),
      },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;
  let parsed;

  try {
    parsed = JSON.parse(raw);
    // Handle both array root and {questions: [...]} wrapper
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    // Some models wrap in first key
    const firstKey = Object.keys(parsed)[0];
    if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
    throw new Error('Unexpected JSON structure from AI');
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${e.message}`);
  }
}

async function validateQuestion(question, content, objectives) {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: QA_SYSTEM_PROMPT },
      { role: 'user', content: buildQAPrompt(question, content, objectives) },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

async function improveDistractors(question, content) {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      { role: 'system', content: 'You are an assessment specialist. Return only valid JSON.' },
      { role: 'user', content: buildDistractorImprovementPrompt(question, content) },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

async function increaseCognitiveLevel(question) {
  const currentIndex = BLOOMS_ORDER.indexOf(question.blooms_level);
  if (currentIndex === BLOOMS_ORDER.length - 1) {
    throw new Error('Question is already at the highest Bloom\'s level (Create)');
  }
  const targetLevel = BLOOMS_ORDER[currentIndex + 1];

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: 'You are an instructional designer. Return only valid JSON.' },
      { role: 'user', content: buildCognitiveLevelPrompt(question, targetLevel) },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

async function regenerateSingleQuestion({ content, objectives, questionType, bloomsLevel, difficulty }) {
  const questions = await generateQuestions({
    content,
    objectives,
    questionType,
    bloomsLevel,
    difficulty,
    count: 1,
  });
  return questions[0];
}

module.exports = {
  generateQuestions,
  validateQuestion,
  improveDistractors,
  increaseCognitiveLevel,
  regenerateSingleQuestion,
  BLOOMS_ORDER,
};
