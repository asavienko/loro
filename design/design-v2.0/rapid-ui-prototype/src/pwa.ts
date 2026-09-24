// The service worker: registered here (not by an injected script) so the app hears
// when a new version is waiting and can offer to reload at a quiet moment.
import { registerSW } from 'virtual:pwa-register';

export const UPDATE_READY_EVENT = 'loro:update-ready';

let update: ((reload?: boolean) => Promise<void>) | null = null;

export function startServiceWorker(): void {
  update = registerSW({
    immediate: true,
    onNeedRefresh: () => window.dispatchEvent(new Event(UPDATE_READY_EVENT)),
  });
}

/** Lets the waiting version take over, and reloads into it. */
export function applyUpdate(): void {
  void update?.(true);
}
