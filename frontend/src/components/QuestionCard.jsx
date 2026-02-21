import React, { useState } from 'react';
import {
  updateQuestion, deleteQuestion, regenerateQuestion,
  validateQuestion, improveDistractors, increaseCognitiveLevel, saveToBank,
} from '../../services/api';
import { scoreClass, getAnswerOptions, TYPE_LABELS, BLOOMS_LEVELS, DIFFICULTIES } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function QuestionCard({ question, content, objectives, onUpdate, onDelete, showSaveButton = true }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [qaResult, setQaResult] = useState(question.qa_feedback || null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [expanded, setExpanded] = useState(true);

  function startEdit() {
    setEditData({
      question_text: question.question_text,
      correct_answer: question.correct_answer,
      distractor_1: question.distractor_1 || '',
      distractor_2: question.distractor_2 || '',
      distractor_3: question.distractor_3 || '',
      explanation: question.explanation || '',
      blooms_level: question.blooms_level,
      difficulty: question.difficulty,
      objective_alignment: question.objective_alignment || '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    try {
      setLoadingAction('save');
      const res = await updateQuestion(question.id, editData);
      onUpdate(res.question);
      setEditing(false);
      toast.success('Question saved');
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRegenerate() {
    setLoadingAction('regen');
    try {
      const res = await regenerateQuestion(question.id, { content, objectives });
      onUpdate(res.question);
      setQaResult(null);
      toast.success('Question regenerated');
    } catch (err) {
      toast.error(`Regenerate failed: ${err}`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleValidate() {
    setLoadingAction('validate');
    try {
      const res = await validateQuestion(question.id, { content, objectives });
      setQaResult(res.qa_result);
      onUpdate({ ...question, qa_score: res.qa_score, qa_feedback: res.qa_result });
      toast.success(`QA score: ${res.qa_score}/10`);
    } catch (err) {
      toast.error(`Validation failed: ${err}`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleImproveDistractors() {
    setLoadingAction('distract');
    try {
      const res = await improveDistractors(question.id, { content });
      onUpdate(res.question);
      toast.success('Distractors improved');
    } catch (err) {
      toast.error(`Failed: ${err}`);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleIncreaseLevel() {
    setLoadingAction('level');
    try {
      const res = await increaseCognitiveLevel(question.id);
      onUpdate(res.question);
      setQaResult(null);
      toast.success(`Level raised to ${res.question.blooms_level}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSaveToBank() {
    try {
      await saveToBank(question.id);
      onUpdate({ ...question, is_saved: 1 });
      toast.success('Saved to Question Bank');
    } catch (err) {
      toast.error(`Failed: ${err}`);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this question?')) return;
    try {
      await deleteQuestion(question.id);
      onDelete(question.id);
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
    }
  }

  const options = getAnswerOptions(question);
  const isLoading = loadingAction !== null;
  const currentLevel = BLOOMS_LEVELS.indexOf(question.blooms_level);

  return (
    <div className="card" style={{
      marginBottom: 12,
      border: question.is_saved ? '1.5px solid var(--success)' : '1px solid var(--gray-200)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: expanded ? 14 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className={`badge badge-${question.question_type}`}>{TYPE_LABELS[question.question_type]}</span>
            <span className="badge badge-blooms" style={{ textTransform: 'capitalize' }}>{question.blooms_level}</span>
            <span className={`badge badge-${question.difficulty}`} style={{ textTransform: 'capitalize' }}>{question.difficulty}</span>
            {question.is_saved && <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>✓ Saved</span>}
          </div>
          {!expanded && (
            <p style={{ fontSize: 14, color: 'var(--gray-700)', fontWeight: 500 }}>{question.question_text}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {question.confidence_score && (
            <div title="Confidence Score">
              <span className={`score-dot ${scoreClass(question.confidence_score)}`}>
                {question.confidence_score}
              </span>
            </div>
          )}
          {question.qa_score && (
            <div title="QA Score">
              <span className={`score-dot ${scoreClass(question.qa_score)}`} style={{ fontSize: 10 }}>
                QA{question.qa_score}
              </span>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {editing ? (
            <EditForm editData={editData} setEditData={setEditData} question={question} />
          ) : (
            <QuestionDisplay question={question} options={options} />
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
            {editing ? (
              <>
                <button className="btn btn-success btn-sm" onClick={saveEdit} disabled={loadingAction === 'save'}>
                  {loadingAction === 'save' ? <><span className="spinner" /> Saving...</> : '💾 Save'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary btn-sm" onClick={startEdit} disabled={isLoading}>✏️ Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={handleRegenerate} disabled={isLoading}>
                  {loadingAction === 'regen' ? <><span className="spinner spinner-dark" /> Regenerating...</> : '🔄 Regenerate'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleValidate} disabled={isLoading}>
                  {loadingAction === 'validate' ? <><span className="spinner spinner-dark" /> Validating...</> : '✅ QA Check'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleImproveDistractors} disabled={isLoading || question.question_type === 'true_false'}>
                  {loadingAction === 'distract' ? <><span className="spinner spinner-dark" /></> : '🎯 Improve Distractors'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleIncreaseLevel}
                  disabled={isLoading || currentLevel === BLOOMS_LEVELS.length - 1}
                  title={currentLevel === BLOOMS_LEVELS.length - 1 ? 'Already at Create level' : 'Raise cognitive level'}
                >
                  {loadingAction === 'level' ? <><span className="spinner spinner-dark" /></> : '⬆️ Raise Level'}
                </button>
                {showSaveButton && !question.is_saved && (
                  <button className="btn btn-success btn-sm" onClick={handleSaveToBank} disabled={isLoading}>
                    🗃 Save to Bank
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={isLoading} style={{ marginLeft: 'auto' }}>
                  🗑 Delete
                </button>
              </>
            )}
          </div>

          {/* QA Result Panel */}
          {qaResult && <QAPanel result={qaResult} />}
        </>
      )}
    </div>
  );
}

function QuestionDisplay({ question, options }) {
  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 12, fontSize: 15, lineHeight: 1.5 }}>{question.question_text}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {options.map((opt) => (
          <div key={opt.letter} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '8px 12px', borderRadius: 'var(--radius)',
            background: opt.correct ? 'var(--success-light)' : 'var(--gray-50)',
            border: `1.5px solid ${opt.correct ? 'var(--success)' : 'var(--gray-200)'}`,
          }}>
            <span style={{
              fontWeight: 700, minWidth: 20, color: opt.correct ? 'var(--success)' : 'var(--gray-500)',
            }}>{opt.letter}.</span>
            <span style={{ color: opt.correct ? 'var(--success)' : 'var(--gray-700)', fontWeight: opt.correct ? 600 : 400 }}>
              {opt.text}
              {opt.correct && <span style={{ marginLeft: 6, fontSize: 12 }}>✓</span>}
            </span>
          </div>
        ))}
      </div>

      {question.explanation && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
          <strong style={{ color: '#92400E' }}>Explanation:</strong>{' '}
          <span style={{ color: '#78350F' }}>{question.explanation}</span>
        </div>
      )}

      {question.objective_alignment && (
        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
          🎯 <strong>Objective:</strong> {question.objective_alignment}
        </p>
      )}
    </div>
  );
}

function EditForm({ editData, setEditData, question }) {
  function set(field, val) {
    setEditData((d) => ({ ...d, [field]: val }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Question Text</label>
        <textarea value={editData.question_text} onChange={(e) => set('question_text', e.target.value)} style={{ minHeight: 80 }} />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Correct Answer</label>
        <input type="text" value={editData.correct_answer} onChange={(e) => set('correct_answer', e.target.value)} />
      </div>

      {question.question_type !== 'true_false' && (
        <>
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Distractor 1</label>
              <input value={editData.distractor_1} onChange={(e) => set('distractor_1', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Distractor 2</label>
              <input value={editData.distractor_2} onChange={(e) => set('distractor_2', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Distractor 3</label>
            <input value={editData.distractor_3} onChange={(e) => set('distractor_3', e.target.value)} />
          </div>
        </>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Explanation</label>
        <textarea value={editData.explanation} onChange={(e) => set('explanation', e.target.value)} style={{ minHeight: 70 }} />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Bloom's Level</label>
          <select value={editData.blooms_level} onChange={(e) => set('blooms_level', e.target.value)}>
            {BLOOMS_LEVELS.map((l) => <option key={l} value={l} style={{ textTransform: 'capitalize' }}>{l}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Difficulty</label>
          <select value={editData.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d} style={{ textTransform: 'capitalize' }}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Objective Alignment Note</label>
        <input value={editData.objective_alignment} onChange={(e) => set('objective_alignment', e.target.value)} />
      </div>
    </div>
  );
}

function QAPanel({ result }) {
  const checks = result.checks || {};
  const severity = result.severity || 'pass';

  const severityColors = {
    pass: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)' },
    warning: { bg: 'var(--warning-light)', border: '#F59E0B', text: 'var(--warning)' },
    fail: { bg: 'var(--danger-light)', border: 'var(--danger)', text: 'var(--danger)' },
  };
  const sc = severityColors[severity] || severityColors.pass;

  return (
    <div style={{
      marginTop: 14, background: sc.bg, border: `1.5px solid ${sc.border}`,
      borderRadius: 'var(--radius)', padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <strong style={{ color: sc.text }}>QA Report</strong>
        <span className={`score-dot ${scoreClass(result.qa_score)}`}>{result.qa_score}/10</span>
        <span style={{ fontSize: 12, color: sc.text, textTransform: 'uppercase', fontWeight: 600 }}>{severity}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {Object.entries(checks).map(([key, check]) => (
          <div key={key} style={{
            background: 'white', border: `1px solid ${check.pass ? 'var(--gray-200)' : 'var(--danger)'}`,
            borderRadius: 6, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span>{check.pass ? '✅' : '❌'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--gray-700)' }}>
                {key.replace(/_/g, ' ')}
              </span>
              <span className={`score-dot ${scoreClass(check.score)}`} style={{ marginLeft: 'auto', width: 22, height: 22, fontSize: 10 }}>
                {check.score}
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4 }}>{check.feedback}</p>
          </div>
        ))}
      </div>

      {result.suggested_improvements?.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--gray-700)' }}>Suggested Improvements:</p>
          <ul style={{ paddingLeft: 16 }}>
            {result.suggested_improvements.map((s, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 3 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.revised_question_text && (
        <div style={{ marginTop: 10, background: 'white', borderRadius: 6, padding: '8px 12px', border: '1px dashed var(--gray-300)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Suggested revision:</p>
          <p style={{ fontSize: 13, color: 'var(--gray-800)', fontStyle: 'italic' }}>{result.revised_question_text}</p>
        </div>
      )}
    </div>
  );
}
