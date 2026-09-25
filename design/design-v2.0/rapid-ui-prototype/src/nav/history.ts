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
  // Called while an overlay is closing (a sheet that opens a page as it goes): wait until
  // its history entry is gone, or the page would land on top of it and leave a dead Back.
  if (!options.replace && (window.history.state as { layer?: number } | null)?.layer) {
    setTimeout(() => whenHistorySettles(() => navigateNow(route, options)), 0);
    return;
  }
  navigateNow(route, options);
}

function navigateNow(route: Route, options: { replace?: boolean }): void {
  const hash = formatRoute(route);
  if (hash === window.location.hash || (hash === '#/' && window.location.hash === '')) return;
  saveScroll();
  if (options.replace) {
    window.history.replaceState(window.history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    // Marked as the app's own entry, so the header's Back can go back to it (keeping its
    // filters and view) instead of pushing a fresh copy of the page.
    window.history.pushState({ inApp: true }, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

/**
 * The header's Back: back through history when this page was opened from the app (the
 * page it came from keeps its filters, view and scroll), otherwise (a shared link, a
 * fresh start) to `fallback`, replacing this entry so browser Back doesn't return here.
 */
export function goBack(fallback: Route): void {
  if ((window.history.state as { inApp?: boolean } | null)?.inApp) window.history.back();
  else navigate(fallback, { replace: true });
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
/** A closed overlay whose entry is about to be popped, unless another overlay takes it over. */
let pendingBack: number | null = null;
/** Work waiting for our own pops to finish (a route change after an overlay closed). */
let afterPops: (() => void)[] = [];

function whenHistorySettles(fn: () => void) {
  if (pendingBack === null && ownPops === 0) fn();
  else afterPops.push(fn);
}

function settled() {
  if (pendingBack !== null || ownPops > 0) return;
  const queued = afterPops;
  afterPops = [];
  queued.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    if (ownPops > 0) {
      ownPops--;
      settled();
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
    // One overlay handing over to another in the same moment (Details → Add to set) takes
    // over the closing one's entry instead of stacking a new one above a pending back.
    if (pendingBack !== null && (window.history.state as { layer?: number } | null)?.layer === pendingBack) {
      pendingBack = null;
      window.history.replaceState({ layer: layer.id }, '');
    } else {
      window.history.pushState({ layer: layer.id }, '');
    }
    return () => {
      const at = layers.indexOf(layer);
      if (at === -1) return; // Closed by Back: its entry is already gone.
      layers.splice(at, 1);
      if ((window.history.state as { layer?: number } | null)?.layer === layer.id) {
        // Popped once this render's effects have run (a microtask), so an overlay opening in
        // the same commit can take the entry over instead. Any later and a reload or link
        // right after closing would be undone by this back().
        pendingBack = layer.id;
        queueMicrotask(() => {
          if (pendingBack !== layer.id) return settled();
          pendingBack = null;
          // Something navigated meanwhile (a link, a typed URL): its entry is on top now, so
          // going back would undo that navigation instead of removing ours.
          if ((window.history.state as { layer?: number } | null)?.layer !== layer.id) return settled();
          ownPops++;
          window.history.back();
        });
      }
    };
  }, [open, close]);
}
