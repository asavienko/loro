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

  // It stays while the learner is on it (hover or keyboard focus), then gives its time again.
  const [held, setHeld] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  // Where keyboard focus came from, to go back to once the message is gone.
  const cameFrom = useRef<HTMLElement | null>(null);
  const hadFocus = useRef(false);
  const focusInside = () => Boolean(layer.current?.contains(document.activeElement));

  const close = useCallback(() => {
    // A removed element takes focus with it; hand it back instead of dropping it on the page.
    if (focusInside()) {
      const back = cameFrom.current;
      if (back?.isConnected) back.focus();
      else (document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]') ?? document.querySelector<HTMLElement>('main h1'))?.focus();
    }
    setItem(null);
    // A removed element fires no leave or blur.
    setHeld(false);
  }, []);

  const toast = useCallback(
    (text: string, options: ToastOptions = {}) => {
      // A new message replaces the text in place: while the learner is on it, it stays held.
      hadFocus.current = focusInside();
      const onIt = hadFocus.current || Boolean(layer.current?.querySelector(':hover'));
      setItem({ id: nextId.current++, text, ...options });
      setHeld(onIt);
      // Say there's an action, or a screen-reader user never learns Undo exists.
      announce(options.action ? `${text}. ${options.action.label}` : text);
    },
    [announce],
  );

  // A replacement without an action drops its Undo button: keep focus on the message.
  useEffect(() => {
    if (item && hadFocus.current && document.activeElement === document.body) dismiss.current?.focus();
    hadFocus.current = false;
  }, [item, held]);

  useEffect(() => {
    if (!item || held) return;
    const timer = setTimeout(close, item.action ? TOAST_WITH_ACTION_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [item, held, close]);

  const api = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
      <div ref={layer} className="toast-layer fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center pointer-events-none">
        <AnimatePresence>
          {item && (
            // One element whatever the message: a new toast replaces the text in place. Keyed per
            // toast, each replaced one lingered until its exit animation ran, and with animation
            // frames stalled (a background tab) they piled up.
            <motion.div
              key="toast"
              onPointerEnter={() => setHeld(true)}
              onPointerLeave={() => setHeld(false)}
              onFocus={(e) => {
                const from = e.relatedTarget as HTMLElement | null;
                if (from && !e.currentTarget.contains(from)) cameFrom.current = from;
                setHeld(true);
              }}
              onBlur={() => setHeld(false)}
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
                    close();
                  }}
                  className="min-h-11 px-3 rounded-xl font-bold text-primary-fixed-dim"
                >
                  {item.action.label}
                </button>
              )}
              <button
                type="button"
                ref={dismiss}
                aria-label={c.toast.dismiss}
                onClick={close}
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
