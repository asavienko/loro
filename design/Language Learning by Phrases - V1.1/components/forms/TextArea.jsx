import React from 'react';

/** Multi-line paste area, used for bulk phrase import. */
export function TextArea({ value, placeholder, rows = 4, onChange, inputRef }) {
  return (
    <textarea ref={inputRef} defaultValue={value} placeholder={placeholder} rows={rows} onChange={onChange}
      style={{ flex: 'none', width: '100%', resize: 'none', border: '1px solid var(--line-card)', borderRadius: 'var(--r-card)', padding: '11px 12px', background: 'var(--paper-raised)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: 'var(--ink-1)', outline: 'none' }} />
  );
}
