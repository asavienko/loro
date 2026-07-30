import React from 'react';

/** Five-bar equaliser shown whenever the app is listening or playing. */
export function VoiceWave({ height = 22, tone = 'accent', bars = [8, 18, 12, 22, 14] }) {
  const color = tone === 'on-dark' ? 'var(--accent-on-dark)' : 'var(--accent)';
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: 3, height: Math.min(h, height), borderRadius: 'var(--r-pip)', background: color, animation: `eqB .9s ease-in-out infinite ${i * 0.1}s` }} />
      ))}
    </div>
  );
}
