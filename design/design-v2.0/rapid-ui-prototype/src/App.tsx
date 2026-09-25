import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Component, ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from './lib/useLatest';
import { setVoiceChoices, stopSpeech } from './audio/speech';
import { usePlaybackDriver } from './audio/driver';
import { applyUpdate, UPDATE_READY_EVENT } from './pwa';
import { useMediaSession } from './audio/mediaSession';
import { learnedCue } from './audio/cues';
import { copyFor, copyForNative, greeting } from './copy';
import { NATIVE_LANGUAGES } from './content';
import { goBack, navigate, useBackToClose, useRoute, useScrollRestoration } from './nav/history';
import { Navigation, NavContext } from './nav/NavContext';
import { Route, tabOf } from './nav/routes';
import { findPhrase, findSetView } from './state/catalog';
import { derive, POINTS } from './state/memory';
import { clearSavedState, rawSavedState, SAVE_FAILED_EVENT, SaveResult } from './state/persistence';
import type { Stored } from './state/storage';
import { currentPhraseId } from './state/selectors';
import { StoreProvider, useCopy, useStore } from './state/store';
import { BottomNavBar } from './ui/BottomNavBar';
import { MiniPlayer } from './ui/MiniPlayer';
import { NavigationHeader } from './ui/NavigationHeader';
import { ToastProvider, useToast } from './ui/Toast';
import { LocalBoundary } from './ui/LocalBoundary';
import { AddPhraseSheet } from './sheets/AddPhraseSheet';
import { AddSheet } from './sheets/AddSheet';
import { AddToSetSheet } from './sheets/AddToSetSheet';
import { CreateSetSheet } from './sheets/CreateSetSheet';
import { PhraseDetailsSheet } from './sheets/PhraseDetailsSheet';
import { SessionSummarySheet } from './sheets/SessionSummarySheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { ExploreScreen } from './screens/ExploreScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { Onboarding } from './screens/Onboarding';
import { QueueScreen } from './screens/QueueScreen';
import { SetScreen } from './screens/SetScreen';
import { btnIcon, btnPrimary, btnTonal } from './ui/button';
import { Icon } from './ui/Icon';

export default function App({ stored }: { stored: Stored }) {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <StoreProvider stored={stored}>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </StoreProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

/** Copy for the error screen, read straight from the saved profile (the store may be what failed). */
function fallbackCopy() {
  try {
    const native = (JSON.parse(rawSavedState() ?? '{}') as { learner?: { profile?: { nativeLang?: string } } }).learner?.profile?.nativeLang;
    const known = NATIVE_LANGUAGES.find((l) => l === native);
    return known ? copyForNative(known) : copyFor('en');
  } catch {
    return copyFor('en');
  }
}

/** Last resort: reload first (progress is kept); if saved progress no longer fits, copy it, then reset. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; copied: boolean }> {
  state = { failed: false, copied: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const c = fallbackCopy();
    const raw = rawSavedState();
    return (
      <main className="min-h-dvh bg-surface text-on-surface flex flex-col justify-center gap-3 px-6 max-w-md mx-auto">
        <h1 className="font-serif text-display-sm font-semibold">{c.error.title}</h1>
        <p className="text-body text-secondary">{c.error.body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${btnPrimary} self-start`}
        >
          {c.error.reload}
        </button>
        {raw && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(raw).then(() => this.setState({ copied: true }));
            }}
            className={`${btnTonal} self-start`}
          >
            {this.state.copied ? c.error.copied : c.error.copy}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void clearSavedState().then(() => window.location.reload());
          }}
          className="self-start min-h-12 px-5 rounded-full text-error font-bold"
        >
          {c.error.reset}
        </button>
      </main>
    );
  }
}

/** A save that fails is said once per session, never silently dropped. */
function useSaveWarnings() {
  const c = useCopy();
  const { toast } = useToast();
  const warned = useRef(false);
  useEffect(() => {
    const onFail = (event: Event) => {
      if (warned.current) return;
      warned.current = true;
      const result = (event as CustomEvent<SaveResult>).detail;
      if (result === 'outdated') toast(c.toast.outdated, { action: { label: c.toast.reload, run: () => window.location.reload() } });
      else toast(result === 'full' ? c.toast.storageFull : c.toast.storageUnavailable);
    };
    window.addEventListener(SAVE_FAILED_EVENT, onFail);
    return () => window.removeEventListener(SAVE_FAILED_EVENT, onFail);
  }, [c, toast]);
}

/**
 * A new version is waiting: offer Reload once, at a moment when nothing is playing,
 * so it never cuts a phrase off. Declined, it takes over on the next launch.
 */
function useUpdatePrompt() {
  const c = useCopy();
  const { state } = useStore();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const offered = useRef(false);
  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener(UPDATE_READY_EVENT, onReady);
    return () => window.removeEventListener(UPDATE_READY_EVENT, onReady);
  }, []);
  const playing = state.player.status === 'playing';
  useEffect(() => {
    if (!ready || playing || offered.current) return;
    offered.current = true;
    toast(c.toast.updateReady, { action: { label: c.toast.reload, run: applyUpdate } });
  }, [ready, playing, c, toast]);
}

/** Learned bonuses and completed passes get a moment of their own. */
function useCelebrations(openSummary: () => void) {
  const c = useCopy();
  const { state } = useStore();
  const { toast } = useToast();
  const learned = derive(state.learner.log).learnedBonuses.size;
  const passes = state.player.session?.passes ?? 0;
  // Continue mode moving on to another set keeps the session; loading one starts a new session.
  const setId = state.player.setId;
  const sessionId = state.player.session?.id;
  const nextSet = findSetView(state.learner, setId)?.title;
  const seen = useRef({ learned, passes, setId, sessionId });
  useEffect(() => {
    if (learned > seen.current.learned) {
      learnedCue();
      toast(c.toast.learned(POINTS.learned), { tone: 'success' });
    }
    if (passes > seen.current.passes) toast(c.toast.passComplete, { action: { label: c.player.summary, run: openSummary } });
    if (nextSet && setId !== seen.current.setId && sessionId !== undefined && sessionId === seen.current.sessionId) toast(c.toast.nextSet(nextSet));
    seen.current = { learned, passes, setId, sessionId };
  }, [learned, passes, setId, sessionId, nextSet, c, toast, openSummary]);
}

type Overlay = { player: boolean; queue: boolean };

/** Home's column (HomeScreen, the same container query): one reading column, then two in the usual width. */
const HOME_COLUMN = 'max-w-2xl @min-[56rem]:max-w-5xl';
/** Each tab's page column, so the top bar's avatar and title line up with the page under them. */
const COLUMN: Partial<Record<Route['name'], string>> = { home: HOME_COLUMN, explore: 'max-w-6xl', library: 'max-w-3xl lg:max-w-6xl' };

function Shell() {
  usePlaybackDriver();
  useMediaSession();
  const c = useCopy();
  const { state, actions } = useStore();
  const route = useRoute();
  useEffect(() => setVoiceChoices(state.prefs.voiceByLang), [state.prefs.voiceByLang]);
  useScrollRestoration(route);
  const currentId = currentPhraseId(state.player);

  const [overlay, setOverlay] = useState<Overlay>({ player: false, queue: false });
  // The player draws a beat after it is asked for: the tap that opens it (often the same tap that
  // starts a queue) paints at once, the mini-player already hidden, and the player slides up in
  // the next render. It closes at once.
  const playerDrawn = useDeferredValue(overlay.player) && overlay.player;
  const [details, setDetails] = useState<{ phraseId: string; ownSetId?: string } | null>(null);
  const [addTo, setAddTo] = useState<string[] | null>(null);
  const [create, setCreate] = useState<{ phraseIds: string[]; rename?: string } | null>(null);
  const [phraseForm, setPhraseForm] = useState<{ editId?: string; target?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAtVoices, setSettingsAtVoices] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // The tab, the app switcher and screen readers say where the learner is (WCAG 2.4.2).
  const pageTitle = !state.learner.profile.onboarded
    ? null
    : overlay.queue
      ? c.queue.title
      : overlay.player
        ? c.player.dialog
        : route.name === 'home'
          ? null
          : route.name === 'set'
            ? findSetView(state.learner, route.id)?.title
            : c.nav[route.name];
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Loro` : 'Loro';
  }, [pageTitle]);

  // A new screen replaces the control that opened it (a set card, Back), which drops
  // keyboard and screen-reader focus to <body>. Then focus goes to the new screen's
  // heading. A tab switch keeps focus on its tab, so nothing moves.
  // Coming back to a screen, focus returns to the control that left it (the set card
  // that was opened), found again by its accessible name; otherwise the heading.
  const screenId = route.name === 'set' ? `set-${route.id}` : route.name;
  const lastFocused = useRef(new Map<string, string>());
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const el = event.target as HTMLElement;
      const name = el.getAttribute?.('aria-label') ?? el.textContent?.trim();
      if (name && el.closest('main')) lastFocused.current.set(screenId, name);
    };
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, [screenId]);
  useEffect(() => {
    const restore = () => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const name = lastFocused.current.get(screenId);
      const again = name
        ? [...document.querySelectorAll<HTMLElement>('main button, main a[href]')].find((el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name)
        : undefined;
      if (again) {
        again.focus({ preventScroll: true });
        return;
      }
      const heading = document.querySelector<HTMLElement>('main h1, header h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    };
    // Now, and again once a closing sheet's exit animation has ended: its own focus
    // return can land on the previous page's heading, which this screen then removed.
    const frame = requestAnimationFrame(restore);
    const later = setTimeout(restore, 700);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
    };
  }, [screenId]);

  useEffect(() => stopSpeech, []);
  // The page's language is the UI's, so screen readers pronounce it right and
  // Cyrillic uses the local letterforms.
  useEffect(() => {
    document.documentElement.lang = c.locale;
  }, [c.locale]);
  const closePlayer = () => setOverlay({ player: false, queue: false });
  const closeSheets = () => {
    setSettingsOpen(false);
    setSummaryOpen(false);
    setDetails(null);
    setAddTo(null);
    setCreate(null);
    setPhraseForm(null);
    setAddOpen(false);
  };
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const closeQueue = () => setOverlay((o) => ({ ...o, queue: false }));
  useBackToClose(overlay.player, closePlayer);
  useBackToClose(overlay.queue, closeQueue);
  // The queue emptied under the player (a course switch in Settings over it): close it, or
  // the page would stay inert behind a player that isn't drawn. Adjusted during render.
  if (overlay.player && !currentId) setOverlay({ player: false, queue: false });

  const routeRef = useLatest(route);
  const learnerRef = useLatest(state.learner);
  const playerRef = useLatest(state.player);

  const nav: Navigation = useMemo(
    () => ({
      go: (next: Route) => navigate(next),
      openSet: (setId) => {
        // A page opened from inside the player (a set just created there) shows in its place.
        setOverlay((o) => (o.player ? { player: false, queue: false } : o));
        navigate({ name: 'set', id: setId, from: tabOf(routeRef.current) });
      },
      playSet: (setId, options = {}) => {
        const view = findSetView(learnerRef.current, setId);
        if (!view) return;
        actions.load(options.phraseIds ?? view.phraseIds, setId, options.startIndex ?? 0, options.shuffle ?? false);
      },
      playPhraseInSet: (phraseId) => {
        const phrase = findPhrase(learnerRef.current, phraseId);
        const view = findSetView(learnerRef.current, phrase?.setId);
        const player = playerRef.current;
        // Another queue is going (a review, another set): play this phrase now, and keep that
        // queue after it rather than throwing it away without a word.
        if (player.order.length > 0 && player.setId !== view?.id) {
          if (player.order[player.index] === phraseId) {
            actions.jump(player.index, true); // already the one playing: from its start
            return;
          }
          const later = player.order.indexOf(phraseId, player.index + 1);
          if (later !== -1) {
            actions.jump(later, true); // already coming up: go to it
            return;
          }
          // Inserted next without changing whose queue it is (its set, continue mode).
          actions.restoreUpNext([phraseId], 0);
          actions.jump(player.index + 1, true);
          return;
        }
        if (view) actions.load(view.phraseIds, view.id, view.phraseIds.indexOf(phraseId));
        else actions.load([phraseId], null, 0);
      },
      playList: (phraseIds, startIndex = 0, source) => actions.load(phraseIds, null, startIndex, false, source ?? null),
      openPlayer: () => setOverlay({ player: true, queue: false }),
      openQueue: () => setOverlay({ player: true, queue: true }),
      openSummary: () => setSummaryOpen(true),
      showDetails: (phraseId, context = {}) => setDetails({ phraseId, ...context }),
      addToSet: (phraseIds) => setAddTo(phraseIds),
      addPhrase: (options = {}) => setPhraseForm(options),
      createSet: (phraseIds = [], rename) => setCreate({ phraseIds, rename }),
      openSettings: () => {
        setSettingsAtVoices(false);
        setSettingsOpen(true);
      },
      openVoiceSettings: () => {
        setSettingsAtVoices(true);
        setSettingsOpen(true);
      },
    }),
    [actions, routeRef, learnerRef, playerRef],
  );
  useCelebrations(nav.openSummary);
  useSaveWarnings();
  useUpdatePrompt();

  if (!state.learner.profile.onboarded) {
    return (
      <NavContext.Provider value={nav}>
        <Onboarding />
      </NavContext.Provider>
    );
  }

  const tab = tabOf(route);
  const setView = route.name === 'set' ? findSetView(state.learner, route.id) : undefined;
  const behind = overlay.player;
  const screenKey = route.name === 'set' ? `set-${route.id}` : route.name;

  return (
    <NavContext.Provider value={nav}>
      <div className="min-h-dvh bg-surface text-on-surface flex flex-col antialiased">
        <NavigationHeader
          // Home's title is the greeting, in the language being learned.
          title={route.name === 'set' ? undefined : route.name === 'home' ? greeting(state.learner.profile.targetLang, state.learner.profile.name) : c.nav[route.name]}
          titleLang={route.name === 'home' ? state.learner.profile.targetLang : undefined}
          onBack={route.name === 'set' ? () => goBack({ name: route.from }) : undefined}
          onOpenSettings={nav.openSettings}
          inert={behind}
          scrolledTitle={route.name === 'set' ? setView?.title : undefined}
          narrow={route.name === 'set'}
          column={COLUMN[route.name]}
          action={
            route.name === 'library' ? (
              <button type="button" aria-label={c.nav.add} onClick={() => setAddOpen(true)} className={`${btnIcon} text-on-surface`}>
                <Icon name="add" className="text-icon-lg" />
              </button>
            ) : undefined
          }
        />

        {/* Room for the fixed bars: the top bar, the tab bar and mini-player below, or on a wide
            screen the rail on the left and the mini-player alone below (index.css scroll padding matches). */}
        <main inert={behind} className="flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))] phone-landscape:pt-[calc(2.75rem+env(safe-area-inset-top))] pb-[calc(9rem+env(safe-area-inset-bottom))] phone-landscape:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pl-20 lg:pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <LocalBoundary resetKey={screenKey} locale={locale}>
          {route.name === 'set' ? (
            // The set page slides in; switching tabs is instant.
            <motion.div key={screenKey} initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.18 }}>
              <SetScreen setId={route.id} />
            </motion.div>
          ) : route.name === 'home' ? (
            <HomeScreen />
          ) : route.name === 'explore' ? (
            <ExploreScreen filters={route} />
          ) : (
            <LibraryScreen view={route.view} />
          )}
          </LocalBoundary>
        </main>

        {currentId && (
          // Stays mounted under the player so focus can return to it on close.
          // Above the tab bar; on a wide screen, docked at the bottom of the content, right of the rail.
          <div inert={behind} className={`fixed inset-x-2 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] phone-landscape:bottom-[calc(3rem+env(safe-area-inset-bottom))] lg:left-24 lg:right-4 lg:bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 max-w-lg mx-auto ${behind ? 'invisible' : ''}`}>
            <MiniPlayer onOpenPlayer={nav.openPlayer} />
          </div>
        )}

        <BottomNavBar
          current={tab}
          inert={behind}
          onNavigate={(next) => {
            if (next === tab && route.name !== 'set') window.scrollTo({ top: 0, behavior: 'smooth' });
            else navigate({ name: next });
          }}
        />

        {/* A failing overlay closes on its own; the rest of the app keeps working. */}
        <LocalBoundary resetKey={`${overlay.player}${overlay.queue}${currentId}`} quiet onError={closePlayer}>
          <AnimatePresence>
            {playerDrawn && currentId && <NowPlayingScreen key="player" onClose={closePlayer} onOpenQueue={nav.openQueue} />}
            {overlay.queue && <QueueScreen key="queue" onClose={closeQueue} />}
          </AnimatePresence>
        </LocalBoundary>

        <LocalBoundary resetKey={`${settingsOpen}${summaryOpen}${details?.phraseId}${addTo}${create?.rename}${phraseForm?.editId ?? phraseForm !== null}${addOpen}`} quiet onError={closeSheets}>
          <SettingsSheet open={settingsOpen} atVoices={settingsAtVoices} onClose={() => setSettingsOpen(false)} />
          <SessionSummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} />
          <PhraseDetailsSheet details={details} onClose={() => setDetails(null)} />
          <AddToSetSheet phraseIds={addTo} onClose={() => setAddTo(null)} />
          <CreateSetSheet request={create} onClose={() => setCreate(null)} />
          <AddPhraseSheet request={phraseForm} onClose={() => setPhraseForm(null)} />
          <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
        </LocalBoundary>
      </div>
    </NavContext.Provider>
  );
}
