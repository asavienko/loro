import React from 'react';

/** The 344×732 Loro phone: bezel, inner screen, and the only shadow in the system. */
export function PhoneFrame({ accent = 'coral', surface = 'chat', scale = 1, children, style }) {
  const bg = surface === 'app' ? 'var(--paper-screen)' : 'var(--paper-screen-quiet)';
  return (
    <div
      data-accent={accent}
      style={{
        flex: 'none',
        width: 'var(--device-w)',
        height: 'var(--device-h)',
        background: 'var(--paper-device)',
        borderRadius: 'var(--r-device)',
        padding: 'var(--device-pad)',
        boxShadow: 'var(--shadow-device)',
        fontFamily: 'var(--font-sans)',
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
        ...style,
      }}
    >
      <div style={{ width: '100%', height: '100%', background: bg, borderRadius: 'var(--r-screen)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
