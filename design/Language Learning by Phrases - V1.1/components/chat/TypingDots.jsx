import React from 'react';

/** Three-dot indicator while Loro composes a reply. */
export function TypingDots({ tone = 'quiet' }) {
  const color = tone === 'on-dark' ? 'var(--ink-on-dark-muted)' : 'var(--ink-10)';
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 0.15, 0.3].map(d => (
        <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: color, animation: `barJump .9s ease-in-out infinite ${d}s` }} />
      ))}
    </div>
  );
}
