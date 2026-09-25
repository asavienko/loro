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
    window.history.pushState({ inApp: true, pos: ++position }, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

/**
 * The header's Back: back through history when this page was opened from the app (the
 * page it came from keeps its filters, view and scroll), otherwise (a shared link, a
 * fresh start) to `fallback`, replacing this entry so browser Back doesn't return here.
 */
export function goBack(fallback: Route, waitUntil = performance.now() + GO_BACK_WAIT_MS): void {
  // Called as a sheet closes: act once its history entry is gone, as navigate does. For a
  // short while only: a layer entry left behind by a reload has no close coming to wait for.
  // Time, not a count of tries, so a busy device (React slow to commit the close) still waits.
  if (performance.now() < waitUntil && (window.history.state as { layer?: number } | null)?.layer) {
    setTimeout(() => whenHistorySettles(() => goBack(fallback, waitUntil)), 16);
    return;
  }
  goBackNow(fallback);
}

/** How long Back waits for a closing sheet's history entry to go. */
const GO_BACK_WAIT_MS = 600;

function goBackNow(fallback: Route): void {
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
interface EntryState {
  layer?: number;
  inApp?: boolean;
  /** Order of the entries the app wrote, to tell Back from Forward. */
  pos?: number;
}
let position = typeof window === 'undefined' ? 0 : ((window.history.state as EntryState | null)?.pos ?? 0);
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

/** Set while Forward skips a stale overlay entry; cleared by the popstate that follows. */
let skippingForward = false;
/** How long a forward() gets to arrive before we take it that there was nothing above. */
const FORWARD_WAIT_MS = 150;

/** An overlay's entry whose overlay isn't open: left by a reload, or closed under another. */
const isStale = (state: EntryState | null) => typeof state?.layer === 'number' && !layers.some((l) => l.id === state.layer);

if (typeof window !== 'undefined') {
  // The entry the app started on gets a position too, so every later step has a direction.
  if (typeof (window.history.state as EntryState | null)?.pos !== 'number') {
    window.history.replaceState({ ...(window.history.state as EntryState | null), pos: position }, '');
  }
  // A reload keeps the history entry of an overlay that was open, but not the overlay: step
  // back off it, or the first Back would land on the same page and seem to do nothing.
  if (isStale(window.history.state as EntryState | null)) {
    ownPops++;
    window.history.back();
  }

  window.addEventListener('popstate', (event) => {
    let state = event.state as EntryState | null;
    // An entry without a position is new (a link or a URL typed in): number it. It closes an
    // open overlay like Back does.
    if (typeof state?.pos !== 'number') {
      state = { ...state, pos: ++position };
      window.history.replaceState(state, '');
    }
    // Which way the learner went: entries the app wrote carry their position.
    const forward = (state.pos ?? 0) > position;
    position = state.pos ?? position;
    if (ownPops > 0) {
      ownPops--;
      // Our own back() landed on a stale overlay entry: keep going to the page below it.
      if (isStale(state)) {
        ownPops++;
        window.history.back();
        return;
      }
      settled();
      return;
    }
    skippingForward = false;
    if (forward) {
      // Forward can't reopen a closed overlay: keep going forward past its entry. When nothing
      // is above it (the entry is the newest), step back off it instead, or it would leave a
      // Back that does nothing.
      if (isStale(state)) {
        skippingForward = true;
        window.history.forward();
        setTimeout(() => {
          if (!skippingForward) return;
          skippingForward = false;
          ownPops++;
          window.history.back();
        }, FORWARD_WAIT_MS);
      }
      return;
    }
    const top = layers[layers.length - 1];
    if (top && state?.layer !== top.id) {
      layers.pop();
      top.close();
    }
    // Back onto an overlay entry that's no longer open: skip it, so one press does one thing.
    if (isStale(state)) {
      ownPops++;
      window.history.back();
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
      window.history.replaceState({ layer: layer.id, pos: position }, '');
    } else {
      window.history.pushState({ layer: layer.id, pos: ++position }, '');
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
