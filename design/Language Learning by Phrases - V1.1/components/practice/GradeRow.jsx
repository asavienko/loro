import React from 'react';

/** Again / Difficult / Good / Easy, each with its scheduling interval. */
export function GradeRow({ goodInterval = '3 days', onGrade }) {
  const grades = [
    { key: 'again', label: 'Again', sub: '<5 min', color: '#8c3f18', border: '#e2b8a5' },
    { key: 'hard', label: 'Difficult', sub: '~10 min', color: '#8a6414', border: '#e3d1a8' },
    { key: 'good', label: 'Good', sub: goodInterval, color: '#356b4f', border: '#bcd6c6' },
    { key: 'easy', label: 'Easy', sub: 'pushed out', color: '#3f7d5d', border: '#bcd6c6' },
  ];
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {grades.map(g => (
        <div key={g.key} className="lo-tap" onClick={() => onGrade && onGrade(g.key)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '9px 4px', borderRadius: 'var(--r-card)', background: 'var(--paper-raised)', border: '1px solid ' + g.border, cursor: 'pointer' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: g.color, whiteSpace: 'nowrap' }}>{g.label}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-7)', whiteSpace: 'nowrap' }}>{g.sub}</span>
        </div>
      ))}
    </div>
  );
}
