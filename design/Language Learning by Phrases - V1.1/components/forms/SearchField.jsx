import React from 'react';

/** Rounded search field with a focus ring and a clear glyph. */
export function SearchField({ value = '', placeholder = 'Type a phrase, or a topic…', focused = false, onChange, onFocus, onBlur, onClear }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--paper-raised)', border: '1.5px solid ' + (focused ? 'var(--accent)' : 'var(--line-card)'), borderRadius: 'var(--r-card-lg)', padding: '11px 13px', transition: 'border-color var(--dur-ui) ease' }}>
      <input value={value} placeholder={placeholder} onChange={onChange} onFocus={onFocus} onBlur={onBlur}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }} />
      {value ? <span onClick={onClear} style={{ fontSize: 15, color: 'var(--ink-4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, minHeight: 26 }}>✕</span> : null}
    </div>
  );
}
