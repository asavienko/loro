import React from 'react';

/** Push-to-talk: hold to speak, tap to keep listening. 56px, the largest target in the app. */
export function MicButton({ state = 'idle', onPointerDown, onPointerUp, onCancel }) {
  const listening = state !== 'idle';
  return (
    <div
      className="lo-press"
      onPointerDown={state === 'idle' ? onPointerDown : undefined}
      onPointerUp={state === 'holding' ? onPointerUp : undefined}
      onPointerCancel={onCancel}
      style={{
        flex: 'none', width: 56, height: 56, borderRadius: '50%',
        background: 'var(--accent)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2.5,
        boxShadow: 'var(--shadow-lift)', cursor: 'pointer', touchAction: 'none',
        animation: state === 'holding' ? 'pulseRing 1.6s ease-out infinite' : undefined,
      }}
    >
      {listening
        ? <span style={{ width: 13, height: 13, borderRadius: 3, background: '#fff' }} />
        : (<>
            <span style={{ width: 10, height: 15, borderRadius: 5, background: '#fff' }} />
            <span style={{ width: 15, height: 2, borderRadius: 1, background: 'rgba(255,255,255,.85)' }} />
          </>)}
    </div>
  );
}
