import React from 'react';

/** Law N13: a paused session leaves a resumable mark, and the resolved home is the only place it appears. */
export function ResumeStrip({ label = 'Left off 40 minutes ago', title, done = 0, total = 6, restartLabel = 'Start over', onRestart, style }) {
  return (
    <div style={{ flex: 'none', margin: '0 var(--nav-gutter)', padding: '12px 14px', background: 'var(--paper-raised)', border: '1.5px solid var(--accent)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-ink)', textTransform: 'uppercase', letterSpacing: '.11em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{title}</div>
        <div style={{ display: 'flex', gap: 3, marginTop: 7 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: 26, height: 4, borderRadius: 2, background: i < done ? 'var(--accent)' : 'var(--line-card)' }} />
          ))}
        </div>
      </div>
      <span onClick={onRestart} style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer' }}>{restartLabel}</span>
    </div>
  );
}
