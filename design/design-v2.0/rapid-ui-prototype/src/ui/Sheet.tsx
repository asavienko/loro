import { AnimatePresence, motion } from 'motion/react';
import { MouseEvent, ReactNode, useRef } from 'react';
import { useDialog } from '../lib/useDialog';
import { useBackToClose } from '../nav/history';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet. Closes on the backdrop, the Close button, Escape or Back. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  useBackToClose(open, onClose);
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
  const c = useCopy();
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
        className="relative w-full max-w-lg mx-auto bg-surface rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col pb-[env(safe-area-inset-bottom)]"
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
            className="min-w-11 h-11 px-3 -mr-2 rounded-full text-body font-semibold text-primary-container active:bg-surface-container"
          >
            {c.common.close}
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
      </motion.div>
    </div>
  );
}

interface SheetOptionProps {
  icon: IconName;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Set for one-of-many choices (sorting); the option is then a radio. */
  selected?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** A 48px tappable row inside a sheet. */
export function SheetOption({ icon, label, onClick, selected, tone = 'default', disabled }: SheetOptionProps) {
  const isChoice = selected !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role={isChoice ? 'radio' : undefined}
      aria-checked={isChoice ? selected : undefined}
      className={`w-full min-h-12 flex items-center gap-3 px-2 rounded-xl text-left active:bg-surface-container disabled:opacity-50 ${
        tone === 'danger' ? 'text-error' : 'text-on-surface'
      }`}
    >
      <Icon name={icon} className={`text-icon ${tone === 'danger' ? '' : 'text-secondary'}`} />
      <span className={`flex-1 text-row ${selected ? 'font-bold' : 'font-medium'}`}>{label}</span>
      {selected && <Icon name="check" className="text-icon-md text-primary-container" />}
    </button>
  );
}

/** A sheet heading inside the scrolling body. */
export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <h3 className="px-2 text-body font-bold text-on-surface mb-1">{title}</h3>
      {children}
    </section>
  );
}
