// Browser history for the hash router and for overlays. Android's Back button
// and the browser's Back close the topmost overlay (player, queue, a sheet)
// before they leave a page.
import { useEffect, useLayoutEffect, useState } from 'react';
import { useLatest } from '../lib/useLatest';
import { formatRoute, parseRoute, Route } from './routes';

// ---------- routes ----------

function currentRoute(): Route {
  return parseRoute(window.location.hash);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return route;
}

/** Push (or replace) a route. Filters typed into Explore replace, so Back leaves the page. */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = formatRoute(route);
  if (hash === window.location.hash || (hash === '#/' && window.location.hash === '')) return;
  saveScroll();
  if (options.replace) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function routeUrl(route: Route): string {
  return `${window.location.origin}${window.location.pathname}${formatRoute(route)}`;
}

// ---------- scroll, per route ----------

const scrollByHash = new Map<string, number>();

function saveScroll() {
  scrollByHash.set(window.location.hash || '#/', window.scrollY);
}

/** Restores the scroll position a page had when the learner left it. */
export function useScrollRestoration(route: Route): void {
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const onScroll = () => saveScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const hash = formatRoute(route);
  useLayoutEffect(() => {
    window.scrollTo(0, scrollByHash.get(hash) ?? 0);
  }, [hash]);
}

// ---------- overlays ----------

interface Layer {
  id: number;
  close: () => void;
}

const layers: Layer[] = [];
let nextLayerId = 1;
/** Pops caused by our own history.back() when an overlay closes from the UI. */
let ownPops = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    if (ownPops > 0) {
      ownPops--;
      return;
    }
    const top = layers[layers.length - 1];
    const state = event.state as { layer?: number } | null;
    if (top && state?.layer !== top.id) {
      layers.pop();
      top.close();
    }
  });
}

/**
 * While `open`, Back closes this overlay. Closing it any other way removes its
 * history entry, so Back never lands on a stale overlay.
 */
export function useBackToClose(open: boolean, onClose: () => void): void {
  const close = useLatest(onClose);
  useEffect(() => {
    if (!open) return;
    const layer: Layer = { id: nextLayerId++, close: () => close.current() };
    layers.push(layer);
    window.history.pushState({ layer: layer.id }, '');
    return () => {
      const at = layers.indexOf(layer);
      if (at === -1) return; // Closed by Back: its entry is already gone.
      layers.splice(at, 1);
      if ((window.history.state as { layer?: number } | null)?.layer === layer.id) {
        ownPops++;
        window.history.back();
      }
    };
  }, [open, close]);
}
