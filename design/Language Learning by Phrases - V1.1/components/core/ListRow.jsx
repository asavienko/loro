import React from 'react';

/** Hairline-separated row — Loro lists things with dividers, not cards. */
export function ListRow({ children, first = false, onClick, style }) {
  return (
    <div className={onClick ? 'lo-row' : undefined} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0', borderTop: first ? 'none' : '1px solid var(--line-hair)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  );
}
