// Confirmations and undo: a snackbar above the mini-player, and one persistent
// live region that every announcement goes through (a freshly inserted status
// node often isn't read).
import { AnimatePresence, motion } from 'motion/react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCopy } from '../state/store';

interface ToastOptions {
  action?: { label: string; run: () => void };
  tone?: 'info' | 'success';
}

interface ToastItem extends ToastOptions {
  id: number;
  text: string;
}

interface ToastApi {
  toast: (text: string, options?: ToastOptions) => void;
  /** Read out without showing anything. */
  announce: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_MS = 4000;
const TOAST_WITH_ACTION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useCopy();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [message, setMessage] = useState('');
  const nextId = useRef(1);

  const announce = useCallback((text: string) => {
    // Clearing first makes a repeated message count as new.
    setMessage('');
    requestAnimationFrame(() => setMessage(text));
  }, []);

  const toast = useCallback(
    (text: string, options: ToastOptions = {}) => {
      setItem({ id: nextId.current++, text, ...options });
      announce(text);
    },
    [announce],
  );

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setItem(null), item.action ? TOAST_WITH_ACTION_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [item]);

  const api = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
      <div className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center pointer-events-none">
        <AnimatePresence>
          {item && (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`pointer-events-auto max-w-md w-full min-h-12 pl-4 pr-1 rounded-2xl shadow-lg flex items-center gap-2 text-body ${
                item.tone === 'success' ? 'bg-tertiary text-on-tertiary' : 'bg-inverse-surface text-inverse-on-surface'
              }`}
            >
              <span aria-hidden="true" className="flex-1 py-2">
                {item.text}
              </span>
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.run();
                    setItem(null);
                  }}
                  className="min-h-11 px-3 rounded-xl font-bold text-primary-fixed-dim"
                >
                  {item.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label={c.common.close}
                onClick={() => setItem(null)}
                className="w-11 h-11 rounded-xl flex items-center justify-center opacity-80"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-icon-md">close</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
