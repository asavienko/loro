// Modal dialog behaviour shared by the player, the queue and sheets: focus
// moves in when it opens and back when it closes, Tab stays inside, and
// Escape closes it. Dialogs stack (a sheet over the queue), and only the
// topmost one handles keys.
import { RefObject, useEffect, useState } from 'react';
import { useLatest } from './useLatest';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];

/** Call from a component that is mounted exactly while its dialog is open. */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  const onCloseRef = useLatest(onClose);
  // Read while rendering: by the time effects run, opening the dialog may have
  // made the opener inert, which already moved focus to <body>.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const id = Symbol('dialog');
    stack.push(id);
    const returnTo = opener;
    const node = ref.current;
    // Only what Tab actually reaches: a hidden, inert or tabindex="-1" element (an unselected tab)
    // counted as "last" would let Tab slip out of the dialog.
    const focusables = () =>
      node
        ? [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[inert]'))
        : [];
    (focusables()[0] ?? node)?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !node?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !node?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [ref, opener, onCloseRef]);
}
