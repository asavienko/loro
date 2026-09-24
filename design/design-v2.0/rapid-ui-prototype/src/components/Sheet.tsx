import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useDialog } from '../lib/useDialog';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom sheet. Closes on backdrop tap, the Close button or Escape. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <SheetPanel title={title} onClose={onClose}>
          {children}
        </SheetPanel>
      )}
    </AnimatePresence>
  );
}

function SheetPanel({ title, onClose, children }: Omit<SheetProps, 'open'>) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div ref={ref} className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      {/* Pointer-only backdrop: keyboard users have the Close button and Escape. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-lg mx-auto bg-surface rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-surface-container-high">
          <h2 className="font-serif text-lg font-semibold text-on-surface truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-11 h-11 px-3 -mr-2 rounded-full text-sm font-semibold text-primary-container active:bg-surface-container"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
      </motion.div>
    </div>
  );
}

interface SheetOptionProps {
  icon: string;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Set for one-of-many choices (sorting); the option is then a radio. */
  selected?: boolean;
  tone?: 'default' | 'danger';
}

/** A 48px tappable row inside a sheet. */
export function SheetOption({ icon, label, onClick, selected, tone = 'default' }: SheetOptionProps) {
  const isChoice = selected !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      role={isChoice ? 'radio' : undefined}
      aria-checked={isChoice ? selected : undefined}
      className={`w-full min-h-12 flex items-center gap-3 px-2 rounded-xl text-left active:bg-surface-container ${
        tone === 'danger' ? 'text-error' : 'text-on-surface'
      }`}
    >
      <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${tone === 'danger' ? '' : 'text-secondary'}`}>
        {icon}
      </span>
      <span className={`flex-1 text-[15px] ${selected ? 'font-bold' : 'font-medium'}`}>{label}</span>
      {selected && <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary-container">check</span>}
    </button>
  );
}
