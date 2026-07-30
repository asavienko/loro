import React from 'react';

/** The only filled control in Loro: one primary pill per screen. */
export function PillButton({ children, variant = 'primary', full = false, onClick, style }) {
  const base = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 'var(--hit-primary)', padding: '0 16px', borderRadius: 'var(--r-pill-lg)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', flex: full ? 1 : 'none', boxSizing: 'border-box' };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff' },
    grow: { background: 'var(--grow)', color: '#fff' },
    secondary: { background: 'var(--paper-raised)', border: '1px solid var(--line-soft)', color: 'var(--ink-2)' },
    quiet: { background: 'var(--paper-well)', color: 'var(--ink-2)' },
    dark: { background: 'var(--ink-1)', color: 'var(--paper-screen)' },
  };
  return <button className="lo-tap" onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}
