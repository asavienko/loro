import React from 'react';

/** Setup progress: filled bars for steps done, hairline for steps ahead. */
export function StepDots({ step = 0, total = 4, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {onBack ? <div className="lo-tap" onClick={onBack} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, fontSize: 15, color: 'var(--ink-4)', cursor: 'pointer' }}>‹</div> : null}
      <div style={{ flex: 1, display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 'var(--r-pip)', background: i <= step ? 'var(--accent)' : 'var(--line-card)', transition: 'background var(--dur-move) ease' }} />
        ))}
      </div>
      <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-7)', fontVariantNumeric: 'tabular-nums' }}>{step + 1}/{total}</span>
    </div>
  );
}
