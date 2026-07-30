import React from 'react';

/** Text-only rail on a hairline under the header — carries counts, never sits in the thumb arc. */
export function NavRail({ items = [], onMore, style }) {
  return (
    <div style={{ flex: 'none', padding: '0 var(--nav-gutter) 10px', display: 'flex', alignItems: 'center', gap: 'var(--rail-gap-x)', borderBottom: '1px solid var(--line-hair)', ...style }}>
      {items.map((it, i) => (
        <div key={i} onClick={it.onClick} style={{ display: 'flex', alignItems: 'baseline', gap: 4, minHeight: 'var(--rail-h)', cursor: it.onClick ? 'pointer' : undefined }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: it.active ? 'var(--ink-1)' : 'var(--rail-label)' }}>{it.label}</span>
          {it.count != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--rail-count)' }}>{it.count}</span>}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {onMore && <div onClick={onMore} style={{ display: 'flex', alignItems: 'center', minHeight: 'var(--rail-h)', cursor: 'pointer' }}><span style={{ fontSize: 15, color: 'var(--ink-6)' }}>⋯</span></div>}
    </div>
  );
}
