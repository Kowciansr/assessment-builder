import React, { useState, useEffect, useCallback } from 'react';
import { getQuestionBank } from '../services/api';
import QuestionCard from '../components/Editor/QuestionCard';
import ExportPanel from '../components/Export/ExportPanel';
import { BLOOMS_LEVELS, DIFFICULTIES, QUESTION_TYPES, TYPE_LABELS } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function BankPage() {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [filters, setFilters] = useState({
    search: '',
    blooms_level: '',
    difficulty: '',
    question_type: '',
    tag: '',
  });

  const [selectedIds, setSelectedIds] = useState([]);

  const fetchBank = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await getQuestionBank(params);
      setQuestions(res.questions);
      setTotal(res.total);
    } catch (err) {
      toast.error(`Failed to load bank: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchBank(); }, [fetchBank]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ search: '', blooms_level: '', difficulty: '', question_type: '', tag: '' });
    setPage(1);
  }

  const hasFilters = Object.values(filters).some(Boolean);

  const handleUpdate = useCallback((updated) => {
    setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
  }, []);

  const handleDelete = useCallback((id) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setSelectedIds((ids) => ids.filter((i) => i !== id));
    setTotal((t) => t - 1);
  }, []);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🗃 Question Bank</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>{total} saved questions</p>
        </div>
        <ExportPanel selectedIds={selectedIds} bankOnly={selectedIds.length === 0} questionCount={total} />
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <input
              type="search"
              placeholder="Search questions, explanations..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Bloom's Level</label>
            <select value={filters.blooms_level} onChange={(e) => setFilter('blooms_level', e.target.value)}>
              <option value="">All levels</option>
              {BLOOMS_LEVELS.map((l) => <option key={l} value={l} style={{ textTransform: 'capitalize' }}>{l}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Difficulty</label>
            <select value={filters.difficulty} onChange={(e) => setFilter('difficulty', e.target.value)}>
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d} style={{ textTransform: 'capitalize' }}>{d}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Question Type</label>
            <select value={filters.question_type} onChange={(e) => setFilter('question_type', e.target.value)}>
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          {hasFilters && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ alignSelf: 'flex-end', marginBottom: 0 }}>
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {questions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, color: 'var(--gray-500)' }}>
          <input
            type="checkbox"
            checked={selectedIds.length === questions.length}
            onChange={() => {
              if (selectedIds.length === questions.length) setSelectedIds([]);
              else setSelectedIds(questions.map((q) => q.id));
            }}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span>{selectedIds.length} selected</span>
        </div>
      )}

      {/* Questions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
          <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
          <p style={{ marginTop: 12 }}>Loading...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h3>{hasFilters ? 'No matching questions' : 'Question bank is empty'}</h3>
          <p>{hasFilters ? 'Try adjusting your filters.' : 'Generate questions and save them to the bank.'}</p>
        </div>
      ) : (
        <>
          {questions.map((q) => (
            <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(q.id)}
                onChange={() =>
                  setSelectedIds((prev) =>
                    prev.includes(q.id) ? prev.filter((i) => i !== q.id) : [...prev, q.id]
                  )
                }
                style={{ marginTop: 16, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <QuestionCard
                  question={q}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  showSaveButton={false}
                />
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                ← Prev
              </button>
              <span style={{ padding: '5px 12px', fontSize: 13, color: 'var(--gray-600)' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
