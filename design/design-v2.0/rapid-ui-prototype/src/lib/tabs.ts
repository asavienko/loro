import { KeyboardEvent } from 'react';

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * Arrow keys, Home and End for a tablist: move the selection and the focus
 * together, as the ARIA tabs pattern expects.
 */
export function tabListKeyDown<T extends string>(
  prefix: string,
  ids: readonly T[],
  current: NoInfer<T>,
  select: (id: NoInfer<T>) => void,
) {
  return (event: KeyboardEvent) => {
    const at = ids.indexOf(current);
    const moves: Record<string, number> = {
      ArrowRight: (at + 1) % ids.length,
      ArrowLeft: (at - 1 + ids.length) % ids.length,
      Home: 0,
      End: ids.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(ids[next]);
    document.getElementById(tabId(prefix, ids[next]))?.focus();
  };
}
