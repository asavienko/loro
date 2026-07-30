import React from 'react';

/** Big number + caps label, used on progress and recap screens. */
export function StatFigure({ value, label, size = 'md', tone = 'ink' }) {
  const sizes = { sm: 20, md: 24, lg: 40, hero: 74 };
  return (
    <div>
      <div style={{ fontSize: sizes[size], fontWeight: 600, letterSpacing: 'var(--track-display)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, color: tone === 'accent' ? 'var(--accent-ink)' : 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.13em', marginTop: 3, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
