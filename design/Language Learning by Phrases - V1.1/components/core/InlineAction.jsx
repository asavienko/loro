import React from 'react';

/** Text-only tap action — Loro's workhorse control. 11–12px, 700, 40px tap height. */
export function InlineAction({ children, glyph, tone = 'quiet', onClick, style }) {
  const colors = { quiet: 'var(--ink-4)', accent: 'var(--accent-ink)', grow: 'var(--grow-soft)', faint: 'var(--ink-6)', alert: 'var(--alert-quiet)', strong: 'var(--ink-1)' };
  return (
    <div className="lo-tap" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', ...style }}>
      {glyph ? <span style={{ fontSize: 11, color: colors[tone] }}>{glyph}</span> : null}
      <span style={{ fontSize: 11, fontWeight: 700, color: colors[tone], whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
