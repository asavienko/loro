import React from 'react';

/** In-device bottom sheet with scrim, grabber and a Done row. */
export function BottomSheet({ open, onClose, children, footer }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 9, background: 'rgba(26,24,21,.24)', animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: '82%', background: 'var(--paper-screen-quiet)', borderRadius: 'var(--r-sheet-in-device)', padding: '16px 20px 22px', display: 'flex', flexDirection: 'column', animation: 'sheetUp var(--dur-sheet) var(--ease-pop)' }}>
        <div style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, background: 'var(--line-field)', marginBottom: 12 }} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
        {footer ? <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 20, marginTop: 16 }}>{footer}</div> : null}
      </div>
    </>
  );
}
