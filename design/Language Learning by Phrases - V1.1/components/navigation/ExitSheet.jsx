import React from 'react';

/** Leaving a session: pause before end, in the product's voice. */
export function ExitSheet({ title, body, pauseLabel = 'Pause the wave', endLabel = 'End it here', stayLabel = 'Keep going', footnote, onPause, onEnd, onStay, style }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: 'var(--nav-scrim)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9, background: 'var(--paper-screen-quiet)', borderRadius: 'var(--sheet-radius-inset)', padding: '14px 24px 22px', display: 'flex', flexDirection: 'column', ...style }}>
        <div style={{ alignSelf: 'center', width: 'var(--sheet-grip-w)', height: 'var(--sheet-grip-h)', borderRadius: 2, background: 'var(--switcher-handle-ink)', marginBottom: 18 }} />
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.016em', lineHeight: 1.3 }}>{title}</div>
        {body && <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 7 }}>{body}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 20 }}>
          <div onClick={onPause} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'var(--exit-primary-h)', borderRadius: 'var(--cta-radius)', background: 'var(--accent)', cursor: 'pointer' }}><span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{pauseLabel}</span></div>
          <div onClick={onEnd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'var(--exit-option-h)', cursor: 'pointer' }}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-4)' }}>{endLabel}</span></div>
          <div onClick={onStay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'var(--nav-header-tap)', cursor: 'pointer' }}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{stayLabel}</span></div>
        </div>
        {footnote && <div style={{ fontSize: 10.5, color: 'var(--ink-8)', lineHeight: 1.5, marginTop: 14 }}>{footnote}</div>}
      </div>
    </>
  );
}
