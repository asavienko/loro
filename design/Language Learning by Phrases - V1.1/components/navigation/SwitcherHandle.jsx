import React from 'react';

/** Law N16: one handle, same place on every surface class. Pull down or tap. */
export function SwitcherHandle({ hint = 'pull for anywhere', onOpen, style }) {
  return (
    <div onClick={onOpen} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'var(--nav-header-tap)', gap: 3, cursor: onOpen ? 'pointer' : undefined, ...style }}>
      <div style={{ width: 'var(--switcher-handle-w)', height: 'var(--switcher-handle-h)', borderRadius: 2, background: 'var(--switcher-handle-ink)' }} />
      {hint && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--switcher-hint)', letterSpacing: '.09em', textTransform: 'uppercase' }}>{hint}</span>}
    </div>
  );
}
