import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import ContentInput from '../components/ContentInput/ContentInput';
import GenerationControls from '../components/Generator/GenerationControls';
import QuestionCard from '../components/Editor/QuestionCard';
import ExportPanel from '../components/Export/ExportPanel';
import { generateQuestions } from '../services/api';

const DEFAULT_CONFIG = {
  questionType: 'mcq',
  bloomsLevel: 'understand',
  difficulty: 'medium',
  count: 5,
  tags: '',
};

export default function BuilderPage() {
  const [content, setContent] = useState('');
  const [objectives, setObjectives] = useState('');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  function handleContentChange(field, value) {
    if (field === 'content') setContent(value);
    else setObjectives(value);
  }

  function handleConfigChange(field, value) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  async function handleGenerate() {
    if (!content.trim()) { toast.error('Please enter lesson content'); return; }
    if (!objectives.trim()) { toast.error('Please enter learning objectives'); return; }

    setLoading(true);
    try {
      const tags = config.tags
        ? config.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const res = await generateQuestions({
        content,
        objectives,
        questionType: config.questionType,
        bloomsLevel: config.bloomsLevel,
        difficulty: config.difficulty,
        count: config.count,
        tags,
      });

      setQuestions((prev) => [...res.questions, ...prev]);
      setSelectedIds((prev) => [...res.questions.map((q) => q.id), ...prev]);
      toast.success(`Generated ${res.questions.length} questions`);
    } catch (err) {
      toast.error(`Generation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = useCallback((updated) => {
    setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
  }, []);

  const handleDelete = useCallback((id) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setSelectedIds((ids) => ids.filter((i) => i !== id));
  }, []);

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === questions.length) setSelectedIds([]);
    else setSelectedIds(questions.map((q) => q.id));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left panel */}
      <div style={{ position: 'sticky', top: 80 }}>
        <ContentInput
          content={content}
          objectives={objectives}
          onChange={handleContentChange}
        />
        <GenerationControls
          config={config}
          onChange={handleConfigChange}
          onGenerate={handleGenerate}
          loading={loading}
        />
      </div>

      {/* Right panel */}
      <div>
        {questions.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
            </svg>
            <h3>No questions yet</h3>
            <p>Configure your settings and click "Generate Questions" to get started.</p>
          </div>
        ) : (
          <>
            {/* Question list toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 14, padding: '10px 14px',
              background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)',
            }}>
              <input
                type="checkbox"
                checked={selectedIds.length === questions.length && questions.length > 0}
                onChange={toggleSelectAll}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                {questions.length} questions · {selectedIds.length} selected
              </span>

              <div style={{ marginLeft: 'auto' }}>
                <ExportPanel
                  selectedIds={selectedIds}
                  bankOnly={false}
                  questionCount={selectedIds.length}
                />
              </div>
            </div>

            {questions.map((q) => (
              <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  style={{ marginTop: 16, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <QuestionCard
                    question={q}
                    content={content}
                    objectives={objectives}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    showSaveButton={!q.is_saved}
                  />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
