import React from 'react';

/** The switcher: rendered from the route table, drops from the status bar over any class. */
export function SwitcherSheet({ title = 'Where to?', note, groups = [], footerHint = 'pull up to stay', onSearch, style }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: 'var(--nav-scrim)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 'var(--switcher-top)', zIndex: 9, background: 'var(--paper-screen-quiet)', borderRadius: 'var(--switcher-radius)', padding: '14px var(--nav-gutter) 16px', display: 'flex', flexDirection: 'column', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 18, fontWeight: 600, letterSpacing: '-0.016em' }}>{title}</span>
          {onSearch && <span onClick={onSearch} style={{ fontSize: 14, color: 'var(--ink-6)', cursor: 'pointer' }}>⌕</span>}
        </div>
        {note && <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 6 }}>{note}</div>}
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            <div style={{ fontSize: 'var(--nav-label-size)', fontWeight: 700, color: 'var(--ink-7)', textTransform: 'uppercase', letterSpacing: 'var(--nav-label-track)', margin: '18px 0 0' }}>{g.label}</div>
            {g.items.map((it, i) => (
              <div key={i} onClick={it.onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i === g.items.length - 1 && gi === groups.length - 1 ? 'none' : '1px solid var(--line-hair)', cursor: it.onClick ? 'pointer' : undefined }}>
                {it.here && <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}>·</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: it.here ? 700 : 600, color: it.done ? 'var(--ink-4)' : it.locked ? 'var(--ink-9)' : 'var(--ink-1)' }}>{it.label}</div>
                  {it.meta && <div style={{ fontSize: 10.5, color: 'var(--ink-6)', marginTop: 2 }}>{it.meta}</div>}
                </div>
                {it.count != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-ink)' }}>{it.count}</span>}
                {it.state && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--grow)' }}>{it.state}</span>}
                {!it.here && !it.state && <span style={{ fontSize: 13, color: 'var(--ink-10)' }}>›</span>}
              </div>
            ))}
          </React.Fragment>
        ))}
        {footerHint && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginTop: 14 }}>
            <div style={{ width: 'var(--switcher-handle-w)', height: 'var(--switcher-handle-h)', borderRadius: 2, background: 'var(--switcher-handle-ink)' }} />
            <span style={{ fontSize: 9.5, color: 'var(--switcher-hint)' }}>{footerHint}</span>
          </div>
        )}
      </div>
    </>
  );
}
