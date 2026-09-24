import { useEffect, useMemo, useRef } from 'react';

const GHOST_CLICK_WINDOW_MS = 350;

/**
 * Releasing a swipe also produces a click — sometimes before the drag-end
 * callback, sometimes after it, and when the swipe changes the layout the
 * click lands on whatever moved under the finger. Call `block` when a drag
 * starts and `release` when it ends; clicks are swallowed in between and for
 * a short window afterwards. A row that unmounts mid-swipe (it was removed)
 * releases the blocker too, so clicks never stay blocked.
 */
export function useClickBlockerDuringDrag(): { block: () => void; release: () => void } {
  const cleanup = useRef<(() => void) | null>(null);

  const controls = useMemo(() => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remove = () => {
      clearTimeout(timer);
      window.removeEventListener('click', swallow, true);
      cleanup.current = null;
    };
    return {
      block: () => {
        remove();
        window.addEventListener('click', swallow, true);
        cleanup.current = remove;
      },
      release: () => {
        if (!cleanup.current) return;
        timer = setTimeout(remove, GHOST_CLICK_WINDOW_MS);
      },
    };
  }, []);

  useEffect(
    () => () => {
      const remove = cleanup.current;
      if (remove) setTimeout(remove, GHOST_CLICK_WINDOW_MS);
    },
    [],
  );
  return controls;
}
