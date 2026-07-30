import React from 'react';

/** Accent-tint pill holding a count: streak, kept lines, banked phrases. */
export function CountChip({ children, tone = 'accent', onClick }) {
  const tones = {
    accent: { background: 'var(--accent-tint)', color: 'var(--accent-ink)' },
    grow: { background: 'var(--grow-tint)', color: 'var(--grow)' },
    quiet: { background: 'var(--paper-well)', color: 'var(--ink-2)' },
  };
  return (
    <div className={onClick ? 'lo-tap' : undefined} onClick={onClick}
      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 'var(--r-pill)', padding: '6px 11px', cursor: onClick ? 'pointer' : undefined, ...tones[tone] }}>
      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
