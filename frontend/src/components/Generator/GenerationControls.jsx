import React from 'react';
import { BLOOMS_LEVELS, DIFFICULTIES, QUESTION_TYPES, TYPE_LABELS } from '../../utils/helpers';

const BLOOMS_DESCRIPTIONS = {
  remember: 'Recall facts',
  understand: 'Explain concepts',
  apply: 'Use knowledge',
  analyze: 'Break down',
  evaluate: 'Justify judgments',
  create: 'Design & produce',
};

export default function GenerationControls({ config, onChange, onGenerate, loading }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--gray-900)' }}>
        ⚙️ Generation Controls
      </h2>

      {/* Question type */}
      <div className="form-group">
        <label>Question Type</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUESTION_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onChange('questionType', t)}
              className={`btn btn-sm ${config.questionType === t ? 'btn-primary' : 'btn-secondary'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Bloom's level */}
      <div className="form-group">
        <label>Bloom's Taxonomy Level</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {BLOOMS_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => onChange('bloomsLevel', l)}
              className={`btn btn-sm ${config.bloomsLevel === l ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px', height: 'auto' }}
            >
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{l}</span>
              <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 400 }}>{BLOOMS_DESCRIPTIONS[l]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="form-group">
        <label>Difficulty Level</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => onChange('difficulty', d)}
              className={`btn btn-sm ${config.difficulty === d ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize', flex: 1 }}
            >
              {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {d}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="form-group">
        <label>Number of Questions: <strong>{config.count}</strong></label>
        <input
          type="range"
          min="1"
          max="20"
          value={config.count}
          onChange={(e) => onChange('count', parseInt(e.target.value, 10))}
          style={{ width: '100%', padding: 0, border: 'none', boxShadow: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
          <span>1</span><span>10</span><span>20</span>
        </div>
      </div>

      {/* Tags */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Topic Tags (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g., photosynthesis, biology, chapter-3"
          value={config.tags}
          onChange={(e) => onChange('tags', e.target.value)}
        />
      </div>

      <button
        className="btn btn-primary btn-lg"
        onClick={onGenerate}
        disabled={loading}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {loading ? (
          <><span className="spinner" /> Generating {config.count} Questions...</>
        ) : (
          <>⚡ Generate {config.count} Questions</>
        )}
      </button>
    </div>
  );
}
