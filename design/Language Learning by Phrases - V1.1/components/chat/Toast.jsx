import React from 'react';

/** Dark confirmation pill. Appears above the composer, ~2s (2.6s with an action), one line only. */
export function Toast({ children, bottom = 84, actionLabel, onAction }) {
  if (!children) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', bottom, transform: 'translateX(-50%)', zIndex: 12, display: 'flex', alignItems: 'center', gap: 13, background: 'var(--ink-1)', color: 'var(--ink-on-dark)', fontSize: 12, fontWeight: 700, padding: '10px 15px', borderRadius: 14, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-toast)', animation: 'popIn .3s var(--ease-pop)' }}>
      <span>{children}</span>
      {actionLabel && onAction ? <span className="lo-tap" onClick={onAction} style={{ fontWeight: 700, color: 'var(--accent-on-dark)', cursor: 'pointer' }}>{actionLabel}</span> : null}
    </div>
  );
}
