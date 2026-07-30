import React from 'react';
import { Tag } from '../core/Tag.jsx';

/** A phrase offered for reuse: suggestion, alternative, or a kept line. */
export function PhraseRow({ es, en, register, state, onPick, onHear, onSecondary, secondaryLabel, first = false }) {
  return (
    <div className="lo-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0', borderTop: first ? 'none' : '1px solid var(--line-hair)' }}>
      <div onClick={onPick} style={{ flex: 1, minWidth: 0, cursor: onPick ? 'pointer' : undefined }}>
        <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.35 }}>{es}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 'var(--fs-label-lg)', color: 'var(--ink-7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{en}</span>
          {register ? <Tag bare>{register}</Tag> : null}
        </div>
      </div>
      {onHear ? <div className="lo-tap" onClick={onHear} style={{ flex: 'none', width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--ink-6)', cursor: 'pointer' }}>♪</div> : null}
      {state ? <div style={{ flex: 'none', width: 22, textAlign: 'center', fontSize: 15, fontWeight: 700, color: state === 'saved' ? 'var(--grow-soft)' : 'var(--accent-ink)' }}>{state === 'saved' ? '✓' : '+'}</div> : null}
      {onSecondary ? (
        <div className="lo-tap" onClick={onSecondary} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-field)', borderRadius: 16, padding: '0 11px', minHeight: 34, cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-1)' }}>{secondaryLabel || 'Send'}</span>
        </div>
      ) : null}
    </div>
  );
}
