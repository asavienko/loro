import React from 'react';

/** A single word with its gloss — tap to hear it slowly. */
export function WordChip({ es, gloss, onClick }) {
  return (
    <div className="lo-tap" onClick={onClick} style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-card)', borderRadius: 'var(--r-card)', padding: '7px 11px', textAlign: 'center', cursor: onClick ? 'pointer' : undefined }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{es}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-7)', marginTop: 2 }}>{gloss}</div>
    </div>
  );
}
