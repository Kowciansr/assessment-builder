const Groq = require('groq-sdk');
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama3-70b-8192';

const BLOOMS_VERBS = {
  remember: ['recall', 'recognize', 'identify', 'list', 'name', 'define', 'state', 'match', 'label', 'describe'],
  understand: ['explain', 'summarize', 'paraphrase', 'classify', 'compare', 'interpret', 'illustrate', 'discuss'],
  apply: ['use', 'apply', 'demonstrate', 'solve', 'calculate', 'implement', 'execute', 'perform', 'operate'],
  analyze: ['analyze', 'differentiate', 'examine', 'break down', 'distinguish', 'organize', 'deconstruct', 'compare'],
  evaluate: ['evaluate', 'judge', 'justify', 'critique', 'assess', 'defend', 'prioritize', 'recommend', 'select'],
  create: ['design', 'create', 'develop', 'formulate', 'construct', 'plan', 'produce', 'compose', 'generate'],
};

async function callGemini(systemPrompt, userPrompt, temperature = 0.7) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { temperature, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  }
}

const GENERATION_SYSTEM_PROMPT = `You are an expert instructional designer with deep knowledge of Bloom's Taxonomy and educational assessment.

STRICT RULES:
1. Base ALL questions SOLELY on the provided lesson content. Do not introduce external facts.
2. Every question must have EXACTLY ONE unambiguously correct answer.
3. Distractors must be plausible misconceptions but clearly incorrect to someone who mastered the content.
4. Do NOT use "None of the above" or "All of the above".
5. Questions must match the specified Bloom's level and difficulty.
6. No bias of any kind. Clear, grammatically correct language.

Return ONLY a valid JSON array. No markdown, no commentary.`;

function buildGenerationPrompt({ content, objectives, questionType, bloomsLevel, difficulty, count }) {
  const typeInstructions = {
    mcq: 'Multiple Choice with 1 correct answer + 3 distractors.',
    true_false: 'True/False statement. correct_answer is "True" or "False". distractor_2 and distractor_3 are null.',
    scenario: 'Start with a 2-3 sentence realistic scenario then ask a specific question.',
    case_based: 'Present a 3-4 sentence case with facts from the content, then ask an analytical question.',
  };

  return `LESSON CONTENT:
${content}

LEARNING OBJECTIVES:
${objectives}

PARAMETERS:
- Type: ${questionType} — ${typeInstructions[questionType]}
- Bloom's Level: ${bloomsLevel.toUpperCase()} — Use verbs: ${BLOOMS_VERBS[bloomsLevel].join(', ')}
- Difficulty: ${difficulty.toUpperCase()}
- Count: ${count}

Return a JSON array of exactly ${count} objects with these fields:
[{
  "question_text": "string",
  "question_type": "${questionType}",
  "correct_answer": "string",
  "distractor_1": "string or null",
  "distractor_2": "string or null",
  "distractor_3": "string or null",
  "explanation": "2-3 sentences",
  "blooms_level": "${bloomsLevel}",
  "difficulty": "${difficulty}",
  "objective_alignment": "1 sentence",
  "confidence_score": number 1-10
}]`;
}

function buildQAPrompt(question, content, objectives) {
  return `Evaluate this assessment question for quality.

CONTENT: ${content || 'Not provided'}
OBJECTIVES: ${objectives || 'Not provided'}
QUESTION: ${JSON.stringify(question, null, 2)}

Return JSON:
{
  "qa_score": number 1-10,
  "checks": {
    "objective_alignment": {"pass": boolean, "score": number, "feedback": "string"},
    "blooms_consistency": {"pass": boolean, "score": number, "feedback": "string"},
    "single_correct_answer": {"pass": boolean, "score": number, "feedback": "string"},
    "distractor_plausibility": {"pass": boolean, "score": number, "feedback": "string"},
    "clarity": {"pass": boolean, "score": number, "feedback": "string"},
    "bias_detection": {"pass": boolean, "score": number, "feedback": "string"},
    "grammar": {"pass": boolean, "score": number, "feedback": "string"},
    "content_accuracy": {"pass": boolean, "score": number, "feedback": "string"}
  },
  "suggested_improvements": ["string"],
  "revised_question_text": "string or null",
  "severity": "pass or warning or fail"
}`;
}

const BLOOMS_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

async function generateQuestions({ content, objectives, questionType, bloomsLevel, difficulty, count }) {
  const parsed = await callGemini(GENERATION_SYSTEM_PROMPT, buildGenerationPrompt({ content, objectives, questionType, bloomsLevel, difficulty, count }), 0.7);
  if (Array.isArray(parsed)) return parsed;
  if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
  const firstKey = Object.keys(parsed)[0];
  if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
  throw new Error('Unexpected JSON structure from AI');
}

async function validateQuestion(question, content, objectives) {
  return await callGemini('You are a psychometrician. Return only valid JSON.', buildQAPrompt(question, content, objectives), 0.2);
}

async function improveDistractors(question, content) {
  return await callGemini('You are an assessment specialist. Return only valid JSON.', `Improve the distractors for this question to represent better misconceptions.
CONTENT: ${content || ''}
QUESTION: ${JSON.stringify(question)}
Return JSON: {"distractor_1": "string", "distractor_2": "string", "distractor_3": "string", "rationale": "string"}`, 0.7);
}

async function increaseCognitiveLevel(question) {
  const currentIndex = BLOOMS_ORDER.indexOf(question.blooms_level);
  if (currentIndex === BLOOMS_ORDER.length - 1) throw new Error("Already at highest Bloom's level (Create)");
  const targetLevel = BLOOMS_ORDER[currentIndex + 1];
  return await callGemini('You are an instructional designer. Return only valid JSON.',
    `Rewrite this question to target Bloom's level: ${targetLevel.toUpperCase()} (verbs: ${BLOOMS_VERBS[targetLevel].join(', ')})
QUESTION: ${JSON.stringify(question)}
Return JSON: {"question_text":"string","correct_answer":"string","distractor_1":"string","distractor_2":"string","distractor_3":"string","explanation":"string","blooms_level":"${targetLevel}","objective_alignment":"string","confidence_score":number}`, 0.7);
}

async function regenerateSingleQuestion({ content, objectives, questionType, bloomsLevel, difficulty }) {
  const questions = await generateQuestions({ content, objectives, questionType, bloomsLevel, difficulty, count: 1 });
  return questions[0];
}

module.exports = { generateQuestions, validateQuestion, improveDistractors, increaseCognitiveLevel, regenerateSingleQuestion, BLOOMS_ORDER };
