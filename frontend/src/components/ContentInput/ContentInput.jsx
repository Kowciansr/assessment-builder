import React, { useState } from 'react';
import { uploadFile } from '../../services/api';
import toast from 'react-hot-toast';

export default function ContentInput({ content, objectives, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('paste'); // 'paste' | 'upload'

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      onChange('content', res.content);
      setTab('paste');
      toast.success(`Loaded "${file.name}"`);
    } catch (err) {
      toast.error(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--gray-900)' }}>
        📄 Content & Objectives
      </h2>

      {/* Content tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['paste', 'upload'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
          >
            {t === 'paste' ? '📋 Paste Text' : '📁 Upload File'}
          </button>
        ))}
      </div>

      {tab === 'paste' ? (
        <div className="form-group">
          <label>Lesson Content *</label>
          <textarea
            value={content}
            onChange={(e) => onChange('content', e.target.value)}
            placeholder="Paste your lesson content, notes, or reading material here..."
            style={{ minHeight: 180 }}
          />
          <span style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'right', marginTop: 4 }}>
            {content.length.toLocaleString()} characters
          </span>
        </div>
      ) : (
        <div className="form-group">
          <label>Upload .txt file</label>
          <div style={{
            border: '2px dashed var(--gray-200)',
            borderRadius: 'var(--radius)',
            padding: 32,
            textAlign: 'center',
            background: 'var(--gray-50)',
          }}>
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--gray-500)' }}>
                <span className="spinner spinner-dark" /> Uploading...
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--gray-500)', marginBottom: 12 }}>
                  Drop a .txt file or click to browse
                </p>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  Choose File
                  <input type="file" accept=".txt,text/plain" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Learning objectives */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Learning Objectives *</label>
        <textarea
          value={objectives}
          onChange={(e) => onChange('objectives', e.target.value)}
          placeholder="Enter one objective per line. Example:&#10;- Learners will be able to identify the key components of photosynthesis&#10;- Learners will apply the concept of cellular respiration to real-world scenarios"
          style={{ minHeight: 100 }}
        />
      </div>
    </div>
  );
}
