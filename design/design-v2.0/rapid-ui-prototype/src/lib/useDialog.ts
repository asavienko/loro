// Modal dialog behaviour shared by the player, the queue and sheets: focus
// moves in when it opens and back when it closes, Tab stays inside, and
// Escape closes it. Dialogs stack (a sheet over the queue), and only the
// topmost one handles keys.
import { RefObject, useEffect, useState } from 'react';
import { useLatest } from './useLatest';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];
/** Each open dialog's element and the control that opened it, to find a fallback opener. */
const dialogs = new Map<symbol, { node: HTMLElement | null; opener: HTMLElement | null }>();

/** Where focus goes when there is nowhere better: the page's heading. */
function focusHeading() {
  const heading = document.querySelector<HTMLElement>('main h1, header h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

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
    // Opened from inside another dialog (Details → Add to set): if that one closes, this
    // dialog's opener goes with it, so fall back to what opened that one.
    const parent = [...dialogs.values()].find((d) => d.node && opener && d.node.contains(opener));
    const fallback = parent?.opener ?? null;
    dialogs.set(id, { node, opener: returnTo?.isConnected ? returnTo : fallback });
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
      const newerOpen = stack.indexOf(id) < stack.length - 1;
      stack.splice(stack.indexOf(id), 1);
      dialogs.delete(id);
      // A dialog opened meanwhile (this one handed over to it) keeps focus.
      if (newerOpen) return;
      const target = [returnTo, fallback].find((el) => el?.isConnected);
      if (target) target.focus({ preventScroll: true });
      else if (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) focusHeading();
    };
  }, [ref, opener, onCloseRef]);
}
