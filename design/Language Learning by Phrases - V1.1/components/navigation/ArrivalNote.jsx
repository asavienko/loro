import React from 'react';

/** Arrival is stated once, on one dismissible line — which is what makes a cold-start ✕ read as sensible. */
export function ArrivalNote({ children, onDismiss, style }) {
  return (
    <div style={{ flex: 'none', padding: '0 var(--nav-gutter) 10px', display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      <span style={{ fontSize: 10.5, color: 'var(--ink-8)' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--line-hair)' }} />
      <span onClick={onDismiss} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-6)', cursor: 'pointer' }}>✕</span>
    </div>
  );
}
