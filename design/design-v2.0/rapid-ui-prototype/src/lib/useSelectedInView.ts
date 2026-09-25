import { RefObject, useLayoutEffect } from 'react';

/**
 * Keeps the chosen chip of a one-line chip scroller in view: a view opened from elsewhere (Home's
 * "Learned") or a link would otherwise leave its chip scrolled off the edge. Only the row scrolls
 * sideways; the page never moves. `key` is what the choice depends on.
 */
export function useSelectedInView(row: RefObject<HTMLElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const el = row.current;
    const chosen = el?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]');
    if (!el || !chosen) return;
    const box = el.getBoundingClientRect();
    const chip = chosen.getBoundingClientRect();
    const margin = 16;
    const by = chip.left < box.left + margin ? chip.left - (box.left + margin) : chip.right > box.right - margin ? chip.right - (box.right - margin) : 0;
    if (by !== 0) el.scrollBy({ left: by, behavior: 'instant' });
  }, [row, key]);
}
