import React from 'react';

/** Flashcard: prompt first, answer revealed with the flip keyframe. */
export function RevealCard({ prompt, answer, hint, revealed = false, onReveal, onHear, footer }) {
  return (
    <div style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-card)', borderRadius: 'var(--r-pill)', padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {hint ? <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-7)', textTransform: 'uppercase', letterSpacing: 'var(--track-caps)', marginBottom: 10 }}>{hint}</div> : null}
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.22, letterSpacing: 'var(--track-ui)' }}>{prompt}</div>
      {revealed ? (
        <div style={{ marginTop: 18, width: '100%', animation: 'flip .3s ease' }}>
          <div style={{ height: 1, background: 'var(--line-card)', marginBottom: 16 }} />
          <div className={onHear ? 'lo-tap' : undefined} onClick={onHear} style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-ink)', lineHeight: 1.25, cursor: onHear ? 'pointer' : undefined }}>{answer}</div>
        </div>
      ) : null}
      {!revealed && onReveal ? (
        <div className="lo-tap" onClick={onReveal} style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-pill-lg)', border: '1px solid var(--line-field)', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Show it</span>
        </div>
      ) : null}
      {revealed && footer ? <div style={{ width: '100%', marginTop: 18 }}>{footer}</div> : null}
    </div>
  );
}
