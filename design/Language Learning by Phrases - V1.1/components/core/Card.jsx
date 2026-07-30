import React from 'react';

/** White hairline card — the default container inside a screen. Tones: plain, grow, note, dark. */
export function Card({ tone = 'plain', radius = 'var(--r-card)', children, style, onClick }) {
  const tones = {
    plain: { background: 'var(--paper-raised)', border: '1px solid var(--line-card)', color: 'var(--ink-1)' },
    grow: { background: 'var(--grow-surface)', border: '1px solid var(--grow-line)', color: 'var(--ink-1)' },
    note: { background: 'var(--note-surface)', border: '1px solid var(--note-line)', color: 'var(--note-ink)' },
    dark: { background: 'var(--paper-device-deep)', border: '1px solid #332e27', color: 'var(--ink-on-dark)' },
  };
  return (
    <div className={onClick ? 'lo-row' : undefined} onClick={onClick} style={{ ...tones[tone], borderRadius: radius, padding: '11px 13px', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  );
}
