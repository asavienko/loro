import React from 'react';

/** Law N15: if audio outlives its route, its transport travels. Root and push only. */
export function TransportStrip({ title, meta, tone = 'hairline', onPause, onEnd, style }) {
  const dark = tone === 'dark';
  const bar = (h, d) => <div key={d} style={{ width: 'var(--transport-bar-w)', height: h, borderRadius: 2, background: dark ? 'var(--accent-on-dark)' : 'var(--accent)', animation: `eqB .9s ease-in-out infinite ${d}s` }} />;
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
      ...(dark
        ? { margin: '0 var(--nav-gutter) 10px', padding: '9px 11px', background: 'var(--transport-surface)', borderRadius: 'var(--transport-radius)' }
        : { margin: '0 var(--nav-gutter)', padding: '10px 0', borderTop: '1px solid var(--line-hair)', borderBottom: '1px solid var(--line-hair)' }),
      ...style,
    }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 'var(--transport-eq-h)' }}>
        {[6, 13, 9, 16].map((h, i) => bar(h, i * 0.1))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: dark ? 'var(--ink-on-dark)' : 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {meta && <div style={{ fontSize: 9.5, color: dark ? 'var(--ink-on-dark-muted)' : 'var(--ink-8)' }}>{meta}</div>}
      </div>
      <span onClick={onPause} style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: dark ? 'var(--ink-on-dark)' : 'var(--ink-2)', padding: '0 6px', cursor: 'pointer' }}>❙❙</span>
      <span onClick={onEnd} style={{ flex: 'none', fontSize: 12, color: dark ? 'var(--ink-on-dark-muted)' : 'var(--ink-6)', cursor: 'pointer' }}>✕</span>
    </div>
  );
}
