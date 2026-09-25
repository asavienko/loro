// Confirmations and undo: a snackbar above the mini-player, and one persistent
// live region that every announcement goes through (a freshly inserted status
// node often isn't read).
import { AnimatePresence, motion } from 'motion/react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCopy } from '../state/store';

interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  /** A second choice after the first (with it, the words always take a line of their own). */
  also?: ToastAction;
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
/** Under 20rem of toast (text units, so large text too): the words on one line, the buttons under them. */
const NARROW_WRAP = '@max-[20rem]/toast:flex-wrap';
const NARROW_TEXT = '@max-[20rem]/toast:basis-full @max-[20rem]/toast:pr-3 @max-[20rem]/toast:pb-0';

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useCopy();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [message, setMessage] = useState('');
  const nextId = useRef(1);
  // Said in the next frame; several in one frame are said together. Otherwise the last replaced
  // the others unheard: a rating in the hold (with its Undo) and the end panel it led to.
  const queued = useRef<string[]>([]);

  const announce = useCallback((text: string) => {
    if (queued.current.length === 0) {
      // Clearing first makes a repeated message count as new.
      setMessage('');
      requestAnimationFrame(() => {
        const texts = queued.current;
        queued.current = [];
        setMessage(texts.length === 1 ? texts[0] : texts.map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`)).join(' '));
      });
    }
    if (!queued.current.includes(text)) queued.current.push(text);
  }, []);

  // It stays while the learner is on it (hover or keyboard focus), then gives its time again.
  // Pointer and keyboard hold it separately: leaving with one doesn't release the other.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused;
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
      // The topmost open dialog (the last one rendered), else the page's heading.
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const fallback = dialogs[dialogs.length - 1] ?? document.querySelector<HTMLElement>('main h1');
      const usable = back?.isConnected && !back.closest('[inert]') && (dialogs.length === 0 || dialogs[dialogs.length - 1].contains(back));
      (usable ? back : fallback)?.focus({ preventScroll: true });
    }
    cameFrom.current = null;
    setItem(null);
    // A removed element fires no leave or blur.
    setHovered(false);
    setFocused(false);
  }, []);

  const toast = useCallback(
    (text: string, options: ToastOptions = {}) => {
      // A new message replaces the text in place: while the learner is on it, it stays held.
      hadFocus.current = focusInside();
      setItem({ id: nextId.current++, text, ...options });
      setFocused(hadFocus.current);
      setHovered(Boolean(layer.current?.querySelector(':hover')));
      // Say there's an action, or a screen-reader user never learns Undo exists.
      const actions = [options.action, options.also].filter((a) => a !== undefined);
      announce([text, ...actions.map((a) => a.label)].join('. '));
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
              onPointerEnter={() => setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              onFocus={(e) => {
                const from = e.relatedTarget as HTMLElement | null;
                if (from && !e.currentTarget.contains(from)) cameFrom.current = from;
                setFocused(true);
              }}
              onBlur={(e) => {
                // Moving between its own buttons keeps it held.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              // A container: in a narrow toast (large text, a small phone) the words take a line of
              // their own and the buttons sit under them, rather than the words go one per line.
              className={`@container/toast pointer-events-auto max-w-md w-full rounded-2xl shadow-float text-body ${
                item.tone === 'success' ? 'bg-tertiary text-on-tertiary' : 'bg-inverse-surface text-inverse-on-surface'
              }`}
            >
              {/* Words, actions, ×. One action: one row, or two when narrow (the words, then the
                  action and × on the right). Two actions: the words and ×, then both actions. */}
              <div className={`min-h-12 pl-4 pr-1 flex items-center gap-x-2 ${item.also ? 'flex-wrap' : item.action ? NARROW_WRAP : ''}`}>
                <span aria-hidden="true" className={`flex-1 min-w-0 py-2 ${!item.also && item.action ? NARROW_TEXT : ''}`}>
                  {item.text}
                </span>
                {item.action && (
                  <div className={item.also ? 'order-2 basis-full -mt-1 pb-1 flex flex-wrap justify-end' : 'ml-auto shrink-0 flex'}>
                    {[item.action, item.also].map(
                      (action) =>
                        action && (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => {
                              action.run();
                              close();
                            }}
                            className="min-h-11 px-3 rounded-xl font-bold text-primary-fixed-dim text-right"
                          >
                            {action.label}
                          </button>
                        ),
                    )}
                  </div>
                )}
                <button
                  type="button"
                  ref={dismiss}
                  aria-label={c.toast.dismiss}
                  onClick={close}
                  className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center opacity-80 ${item.also ? 'self-start mt-0.5' : ''}`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-icon-md">close</span>
                </button>
              </div>
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
