import React from 'react';

/** Five-rung mastery ladder: filled pips = rungs climbed. */
export function LadderPips({ level = 0, total = 5, tone = 'accent', label }) {
  const fill = tone === 'grow' ? 'var(--grow)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 5, borderRadius: 'var(--r-pip)', background: i < level ? fill : 'var(--line-card)' }} />
        ))}
      </div>
      {label ? <span style={{ fontSize: 10, fontWeight: 700, color: level >= total ? 'var(--grow)' : 'var(--ink-4)' }}>{label}</span> : null}
    </div>
  );
}
