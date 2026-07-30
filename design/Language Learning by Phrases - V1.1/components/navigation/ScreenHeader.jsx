import React from 'react';

/** The one header band. Its variant IS the surface class: root · push · session · flow. */
export function ScreenHeader({ variant = 'push', date, title, backLabel, action, progress = 0, step = 1, steps = 4, position, onBack, onAction, style }) {
  const pad = { padding: '2px var(--nav-gutter) 10px', display: 'flex', alignItems: 'center', gap: 10, flex: 'none', ...style };
  const glyph = { fontSize: 'var(--nav-back-size)', color: 'var(--ink-4)', cursor: onBack ? 'pointer' : undefined };
  const act = { fontSize: 'var(--nav-action-size)', fontWeight: 700, color: 'var(--ink-2)', cursor: onAction ? 'pointer' : undefined };

  if (variant === 'root') {
    return (
      <div style={{ ...pad, alignItems: 'flex-end', padding: '4px var(--nav-gutter) 10px' }}>
        <div style={{ flex: 1 }}>
          {date && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-6)' }}>{date}</div>}
          <div style={{ fontSize: 'var(--nav-title-size)', fontWeight: 700, letterSpacing: '-0.018em', marginTop: 1 }}>{title}</div>
        </div>
        {action && <span onClick={onAction} style={{ ...act, color: 'var(--accent-ink)' }}>{action}</span>}
      </div>
    );
  }
  if (variant === 'session') {
    return (
      <div style={{ ...pad, gap: 12 }}>
        <span onClick={onBack} style={glyph}>✕</span>
        <div style={{ flex: 1, height: 'var(--nav-progress-h)', borderRadius: 2, background: 'var(--nav-progress-track)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--nav-progress-fill)', borderRadius: 2 }} />
        </div>
        {position && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-6)', fontVariantNumeric: 'tabular-nums' }}>{position}</span>}
      </div>
    );
  }
  if (variant === 'flow') {
    return (
      <div style={pad}>
        <span onClick={onBack} style={glyph}>‹</span>
        <div style={{ flex: 1, display: 'flex', gap: 'var(--nav-step-gap)' }}>
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 'var(--nav-step-h)', borderRadius: 2, background: i < step ? 'var(--nav-step-done)' : 'var(--nav-step-todo)' }} />
          ))}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-7)' }}>{step}/{steps}</span>
      </div>
    );
  }
  return (
    <div style={pad}>
      <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 'var(--nav-row-h)', cursor: onBack ? 'pointer' : undefined }}>
        <span style={glyph}>{backLabel ? '‹' : '✕'}</span>
        <span style={{ fontSize: 'var(--nav-action-size)', fontWeight: 700, color: 'var(--ink-4)' }}>{backLabel || title}</span>
      </div>
      <div style={{ flex: 1 }} />
      {action && <span onClick={onAction} style={act}>{action}</span>}
    </div>
  );
}
