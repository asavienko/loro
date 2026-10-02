// The clip the loop is waiting on while the server makes it (P3-01): set by the driver when the
// server says it is making a phrase's recording, cleared when the wait ends. The player and the mini
// player show it; it is nothing the learner did, so it lives here rather than in the state machine,
// and it holds no number (the server says only that it is making it, not how far along it is).
import { useSyncExternalStore } from 'react';
import type { LanguageCode } from '@shared/content';

export interface ClipMaking {
  /** The loop's cycle it belongs to: a newer phase, a pause or another phrase leaves it behind. */
  cycle: number;
  phraseId: string;
  lang: LanguageCode;
}

let current: ClipMaking | null = null;
const listeners = new Set<() => void>();

function set(next: ClipMaking | null): void {
  if (current === next) return;
  current = next;
  for (const listener of listeners) listener();
}

export function startClipMaking(making: ClipMaking): void {
  set(making);
}

/** Clears the wait of `cycle`, if it is the one shown. */
export function endClipMaking(cycle: number): void {
  if (current?.cycle === cycle) set(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The recording being made for the loop's current step, or null. */
export function useClipMaking(cycle: number, phraseId: string | null): ClipMaking | null {
  const making = useSyncExternalStore(subscribe, () => current);
  return making && making.cycle === cycle && making.phraseId === phraseId ? making : null;
}
