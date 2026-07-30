import React from 'react';

/** Thin horizontal meter for a distribution or a day's completion. */
export function MeterBar({ value = 0, tone = 'accent', height = 5, track = 'var(--line-card)' }) {
  const fill = { accent: 'var(--accent)', grow: 'var(--grow)', gold: 'var(--gold)', ink: 'var(--ink-1)' }[tone];
  return (
    <div style={{ width: '100%', height, borderRadius: 'var(--r-pip)', background: track, overflow: 'hidden' }}>
      <div style={{ width: Math.max(0, Math.min(100, value)) + '%', height: '100%', background: fill, borderRadius: 'var(--r-pip)', transformOrigin: 'left', animation: 'grow .5s var(--ease-out-soft)' }} />
    </div>
  );
}
