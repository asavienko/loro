import React from 'react';

/** Onboarding-style choice: emoji, label, sub, selected accent border. */
export function ChoiceCard({ emoji, label, sub, selected = false, onClick }) {
  return (
    <div className="lo-row" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, background: selected ? 'var(--accent-tint)' : 'var(--paper-raised)', border: '1.5px solid ' + (selected ? 'var(--accent)' : 'var(--line-card)'), borderRadius: 'var(--r-card-lg)', padding: '13px 14px', cursor: 'pointer' }}>
      {emoji ? <span style={{ flex: 'none', fontSize: 20, lineHeight: 1 }}>{emoji}</span> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{label}</div>
        {sub ? <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div> : null}
      </div>
      <span style={{ flex: 'none', width: 20, textAlign: 'center', fontSize: 14, fontWeight: 700, color: selected ? 'var(--accent-ink)' : 'transparent' }}>✓</span>
    </div>
  );
}
