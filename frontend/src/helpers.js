export const BLOOMS_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const QUESTION_TYPES = ['mcq', 'true_false', 'scenario', 'case_based'];

export const BLOOMS_COLORS = {
  remember: '#7C3AED',
  understand: '#2563EB',
  apply: '#059669',
  analyze: '#D97706',
  evaluate: '#DC2626',
  create: '#DB2777',
};

export const TYPE_LABELS = {
  mcq: 'MCQ',
  true_false: 'True/False',
  scenario: 'Scenario',
  case_based: 'Case-Based',
};

export function scoreClass(score) {
  if (score >= 8) return 'score-high';
  if (score >= 5) return 'score-mid';
  return 'score-low';
}

export function getAnswerOptions(question) {
  if (question.question_type === 'true_false') {
    return [
      { letter: 'A', text: 'True', correct: question.correct_answer === 'True' },
      { letter: 'B', text: 'False', correct: question.correct_answer === 'False' },
    ];
  }
  return [
    { letter: 'A', text: question.correct_answer, correct: true },
    { letter: 'B', text: question.distractor_1, correct: false },
    { letter: 'C', text: question.distractor_2, correct: false },
    { letter: 'D', text: question.distractor_3, correct: false },
  ].filter((o) => o.text);
}
