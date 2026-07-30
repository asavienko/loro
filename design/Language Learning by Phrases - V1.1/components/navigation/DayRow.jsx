import React from 'react';

/** Home is the day, in order: time · what happened · what's next. */
export function DayRow({ time, title, meta, state = 'idle', status, last = false, onClick, style }) {
  const done = state === 'done', next = state === 'next';
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: meta && next ? 'baseline' : 'center', gap: 11, padding: 'var(--nav-row-pad-y) 0', borderBottom: last ? 'none' : '1px solid var(--line-hair)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      <span style={{ flex: 'none', width: 'var(--day-time-w)', fontSize: 11, fontWeight: 700, color: next ? 'var(--accent-ink)' : 'var(--ink-9)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: next ? 15 : 14, fontWeight: next ? 700 : 600, color: done ? 'var(--day-done-ink)' : 'var(--day-next-ink)' }}>{title}</div>
        {meta && <div style={{ fontSize: 11, color: 'var(--ink-6)', marginTop: 2 }}>{meta}</div>}
      </div>
      {status && <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--grow-soft)' }}>{status}</span>}
      {next && <span style={{ flex: 'none', fontSize: 13, color: 'var(--accent-ink)' }}>›</span>}
    </div>
  );
}
