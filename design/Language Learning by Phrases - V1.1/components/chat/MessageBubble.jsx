import React from 'react';

/** A line of conversation. Loro speaks as bare text; the learner gets a tinted bubble. */
export function MessageBubble({ from = 'them', es, en, showEn = false, selected = false, fixCount = 0, onClick, children }) {
  const mine = from === 'me';
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 7, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <div onClick={onClick} style={mine
        ? { background: selected ? 'color-mix(in srgb, var(--accent) 18%, var(--paper-screen-quiet))' : 'color-mix(in srgb, var(--accent) 10%, var(--paper-screen-quiet))', borderRadius: 'var(--r-bubble-me)', padding: '11px 14px', cursor: onClick ? 'pointer' : undefined }
        : { cursor: onClick ? 'pointer' : undefined }}>
        <div style={{ fontSize: 'var(--fs-phrase)', fontWeight: 600, lineHeight: 1.4, letterSpacing: 'var(--track-tight)', color: mine ? 'var(--accent-ink)' : (selected ? 'var(--ink-1)' : '#33302a') }}>{es}</div>
        {showEn && en ? <div style={{ fontSize: 'var(--fs-meta-lg)', color: 'var(--ink-7)', marginTop: 4, lineHeight: 1.4 }}>{en}</div> : null}
      </div>
      {fixCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-ink)', letterSpacing: '.03em' }}>{fixCount === 1 ? '1 thing to fix' : fixCount + ' things to fix'}</span>
        </div>
      ) : null}
      {selected && children ? <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>{children}</div> : null}
    </div>
  );
}
