import React from 'react';

/** Circular pronunciation score, 0–100. */
export function ScoreRing({ value = 0, size = 58, label }) {
  const tone = value >= 85 ? '#356b4f' : value >= 65 ? '#8a6414' : '#a94a2b';
  const inner = size - 14;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none', borderRadius: '50%', background: `conic-gradient(${tone} ${Math.max(0, Math.min(100, value))}%, var(--line-card) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: inner, height: inner, borderRadius: '50%', background: 'var(--paper-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: tone, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </div>
      {label ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.4 }}>{label}</span> : null}
    </div>
  );
}
