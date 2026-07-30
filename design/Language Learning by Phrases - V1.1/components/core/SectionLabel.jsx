import React from 'react';

/** Tiny uppercase label. 'app' sits above in-app groups; 'rail' titles a blueprint unit. */
export function SectionLabel({ children, variant = 'app', style }) {
  if (variant === 'rail') {
    return (
      <span style={{ alignSelf: 'stretch', width: '100%', fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 'var(--track-caps-wide)', padding: '0 0 6px', borderBottom: '1px solid var(--line-rule-2)', ...style }}>{children}</span>
    );
  }
  return (
    <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--ink-7)', textTransform: 'uppercase', letterSpacing: 'var(--track-caps)', ...style }}>{children}</div>
  );
}
