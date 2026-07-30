import React from 'react';

/** iOS-style status bar: time, pill notch, battery outline. Always 34px tall. */
export function StatusBar({ time = '9:41' }) {
  return (
    <div style={{ position: 'relative', height: 'var(--status-bar-h)', flex: 'none' }}>
      <span style={{ position: 'absolute', left: 26, top: 10, fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{time}</span>
      <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 84, height: 22, background: '#000', borderRadius: 12 }} />
      <div style={{ position: 'absolute', right: 24, top: 12, width: 17, height: 10, border: '1.5px solid var(--ink-1)', borderRadius: 2 }} />
    </div>
  );
}
