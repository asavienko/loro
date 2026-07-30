import React from 'react';
import { Tag } from '../core/Tag.jsx';

/** One correction: what you said, what it should be, and why. */
export function DiffRow({ was, now, kind, why, first = false }) {
  return (
    <div style={{ padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--line-hair)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--ink-9)', textDecoration: 'line-through' }}>{was}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-10)' }}>→</span>
        <span style={{ fontSize: 'var(--fs-ui)', fontWeight: 700, color: 'var(--ink-1)' }}>{now}</span>
        <div style={{ flex: 1 }} />
        {kind ? <Tag bare style={{ color: 'var(--ink-8)', letterSpacing: '.09em' }}>{kind}</Tag> : null}
      </div>
      {why ? <div style={{ fontSize: 'var(--fs-meta-lg)', color: 'var(--ink-5)', lineHeight: 1.55, marginTop: 6, textWrap: 'pretty' }}>{why}</div> : null}
    </div>
  );
}
