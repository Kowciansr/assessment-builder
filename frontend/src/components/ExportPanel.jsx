import React, { useState } from 'react';
import { exportQuestions } from '../../services/api';
import toast from 'react-hot-toast';

export default function ExportPanel({ selectedIds, bankOnly, questionCount }) {
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!bankOnly && selectedIds.length === 0) {
      toast.error('No questions selected');
      return;
    }
    setExporting(true);
    try {
      await exportQuestions({
        format,
        ids: bankOnly ? null : selectedIds,
        bank_only: bankOnly ? true : undefined,
      });
      toast.success(`Exported as .${format}`);
    } catch (err) {
      toast.error(`Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  }

  const FORMATS = [
    { id: 'csv', label: 'CSV', icon: '📊', desc: 'Spreadsheet / Excel' },
    { id: 'docx', label: 'Word', icon: '📄', desc: '.docx document' },
    { id: 'json', label: 'JSON', icon: '🔗', desc: 'LMS-ready format' },
  ];

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📥 Export</h3>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={`btn btn-sm ${format === f.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, flexDirection: 'column', height: 'auto', padding: '8px 6px' }}
          >
            <span style={{ fontSize: 16 }}>{f.icon}</span>
            <span style={{ fontWeight: 600 }}>{f.label}</span>
            <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>{f.desc}</span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
        {bankOnly
          ? `Exporting entire bank (${questionCount} questions)`
          : `${selectedIds.length} questions selected`}
      </p>

      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={handleExport}
        disabled={exporting || (!bankOnly && selectedIds.length === 0)}
      >
        {exporting ? <><span className="spinner" /> Exporting...</> : `⬇️ Export as .${format}`}
      </button>
    </div>
  );
}
