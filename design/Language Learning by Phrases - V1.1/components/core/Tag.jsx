import React from 'react';

/** Micro caps tag: register ("casual"), mistake kind ("Agreement"), state ("refresh"). */
export function Tag({ children, tone = 'neutral', bare = false, style }) {
  const tones = {
    neutral: { color: 'var(--ink-3)', background: 'var(--paper-well)' },
    accent: { color: 'var(--accent-ink)', background: 'var(--accent-tint)' },
    grow: { color: 'var(--grow)', background: 'var(--grow-tint)' },
    alert: { color: 'var(--alert)', background: 'var(--alert-surface)' },
    gold: { color: 'var(--gold)', background: 'var(--gold-surface)' },
  };
  const t = tones[tone];
  return (
    <span style={{ flex: 'none', fontSize: 9, fontWeight: 700, letterSpacing: 'var(--track-caps-tight)', textTransform: 'uppercase', whiteSpace: 'nowrap', color: t.color, background: bare ? 'transparent' : t.background, padding: bare ? 0 : '4px 7px', borderRadius: 'var(--r-chip)', ...style }}>{children}</span>
  );
}
