import React from 'react';

/** Mode switch: discover / browse / import, or week / month. */
export function SegmentedTabs({ items = [], value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? '0 11px' : '0 14px';
  const h = size === 'sm' ? 34 : 40;
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {items.map(it => {
        const on = it.value === value;
        return (
          <div key={it.value} className="lo-tap" onClick={() => onChange && onChange(it.value)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: h, padding: pad, borderRadius: 'var(--r-pill)', cursor: 'pointer', background: on ? 'var(--ink-1)' : 'transparent', border: '1px solid ' + (on ? 'var(--ink-1)' : 'var(--line-field)') }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', color: on ? 'var(--paper-screen)' : 'var(--ink-3)' }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}
