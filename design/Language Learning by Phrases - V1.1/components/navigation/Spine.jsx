import React from 'react';

/** Law N16: one band, under the status bar, on every surface class.
 *  Left names where you are and opens the switcher. Right is what is still running. */
export function Spine({ place, ongoing, onOpen, onResume, style }) {
  const list = Array.isArray(ongoing) ? ongoing : ongoing ? [ongoing] : [];
  const one = list.length === 1 ? list[0] : null;
  return (
    <div style={{ flex: 'none', minHeight: 'var(--spine-h)', padding: '0 var(--nav-gutter)', display: 'flex', alignItems: 'center', gap: 'var(--spine-gap)', borderBottom: '1px solid var(--line-hair)', ...style }}>
      <div onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 'var(--spine-h)', cursor: onOpen ? 'pointer' : undefined }}>
        <span style={{ fontSize: 'var(--spine-place-size)', fontWeight: 700, color: 'var(--spine-place)' }}>{place}</span>
        <span style={{ fontSize: 10, color: 'var(--spine-caret)' }}>⌄</span>
      </div>
      <div style={{ flex: 1 }} />
      {list.length > 1 && (
        <div onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 'var(--spine-h)', cursor: 'pointer' }}>
          <span style={{ width: 'var(--spine-dot)', height: 'var(--spine-dot)', borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--spine-chip-ink)' }}>{list.length} ongoing</span>
        </div>
      )}
      {one && (
        <div onClick={onResume} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 'var(--spine-h)', cursor: 'pointer' }}>
          {one.playing
            ? <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
                {[5, 11, 7, 9].map((h, i) => <span key={i} style={{ width: 2, height: h, borderRadius: 1, background: 'var(--accent)', animation: `eqB .9s ease-in-out infinite ${i * 0.1}s` }} />)}
              </span>
            : <span style={{ width: 'var(--spine-dot)', height: 'var(--spine-dot)', borderRadius: '50%', background: 'var(--accent)' }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--spine-chip-ink)', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{one.label}</span>
          {one.expanded && <span style={{ fontSize: 10, color: 'var(--ink-6)' }}>⌃</span>}
        </div>
      )}
    </div>
  );
}
