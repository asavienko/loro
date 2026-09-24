import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Component, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from './lib/useLatest';
import { setVoiceChoices, stopSpeech } from './audio/speech';
import { usePlaybackDriver } from './audio/driver';
import { applyUpdate, UPDATE_READY_EVENT } from './pwa';
import { useMediaSession } from './audio/mediaSession';
import { learnedCue } from './audio/cues';
import { copyFor, copyForNative } from './copy';
import { NATIVE_LANGUAGES } from './content';
import { navigate, useBackToClose, useRoute, useScrollRestoration } from './nav/history';
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
        <h1 className="font-serif text-display-sm font-bold">{c.error.title}</h1>
        <p className="text-body text-secondary">{c.error.body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-start min-h-12 px-5 rounded-full bg-primary-container text-on-primary font-bold"
        >
          {c.error.reload}
        </button>
        {raw && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(raw).then(() => this.setState({ copied: true }));
            }}
            className="self-start min-h-12 px-5 rounded-full bg-surface-container text-on-surface font-bold"
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
      toast((event as CustomEvent<SaveResult>).detail === 'full' ? c.toast.storageFull : c.toast.storageUnavailable);
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
  const seen = useRef({ learned, passes });
  useEffect(() => {
    if (learned > seen.current.learned) {
      learnedCue();
      toast(c.toast.learned(POINTS.learned), { tone: 'success' });
    }
    if (passes > seen.current.passes) toast(c.toast.passComplete, { action: { label: c.player.summary, run: openSummary } });
    seen.current = { learned, passes };
  }, [learned, passes, c, toast, openSummary]);
}

type Overlay = { player: boolean; queue: boolean };

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
  const [details, setDetails] = useState<{ phraseId: string; ownSetId?: string } | null>(null);
  const [addTo, setAddTo] = useState<string[] | null>(null);
  const [create, setCreate] = useState<{ phraseIds: string[]; rename?: string } | null>(null);
  const [phraseForm, setPhraseForm] = useState<{ editId?: string; target?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
    const id = requestAnimationFrame(() => {
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
    });
    return () => cancelAnimationFrame(id);
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
  };
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const closeQueue = () => setOverlay((o) => ({ ...o, queue: false }));
  useBackToClose(overlay.player, closePlayer);
  useBackToClose(overlay.queue, closeQueue);

  const routeRef = useLatest(route);
  const learnerRef = useLatest(state.learner);

  const nav: Navigation = useMemo(
    () => ({
      go: (next: Route) => navigate(next),
      openSet: (setId) => navigate({ name: 'set', id: setId, from: tabOf(routeRef.current) }),
      playSet: (setId, options = {}) => {
        const view = findSetView(learnerRef.current, setId);
        if (!view) return;
        actions.load(options.phraseIds ?? view.phraseIds, setId, options.startIndex ?? 0, options.shuffle ?? false);
      },
      playPhraseInSet: (phraseId) => {
        const phrase = findPhrase(learnerRef.current, phraseId);
        const view = findSetView(learnerRef.current, phrase?.setId);
        if (view) actions.load(view.phraseIds, view.id, view.phraseIds.indexOf(phraseId));
        else actions.load([phraseId], null, 0);
      },
      playList: (phraseIds, startIndex = 0) => actions.load(phraseIds, null, startIndex),
      openPlayer: () => setOverlay({ player: true, queue: false }),
      openQueue: () => setOverlay({ player: true, queue: true }),
      openSummary: () => setSummaryOpen(true),
      showDetails: (phraseId, context = {}) => setDetails({ phraseId, ...context }),
      addToSet: (phraseIds) => setAddTo(phraseIds),
      addPhrase: (options = {}) => setPhraseForm(options),
      createSet: (phraseIds = [], rename) => setCreate({ phraseIds, rename }),
      openSettings: () => setSettingsOpen(true),
    }),
    [actions, routeRef, learnerRef],
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
          title={route.name === 'set' ? undefined : route.name === 'home' ? undefined : c.nav[route.name]}
          onBack={route.name === 'set' ? () => navigate({ name: route.from }) : undefined}
          onOpenSettings={nav.openSettings}
          inert={behind}
          scrolledTitle={route.name === 'set' ? setView?.title : undefined}
          narrow={route.name === 'set'}
        />

        <main inert={behind} className="flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(9rem+env(safe-area-inset-bottom))] phone-landscape:pb-[calc(7rem+env(safe-area-inset-bottom))]">
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
          <div inert={behind} className={`fixed inset-x-2 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] phone-landscape:bottom-[calc(3rem+env(safe-area-inset-bottom))] z-30 max-w-lg mx-auto ${behind ? 'invisible' : ''}`}>
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
            {overlay.player && currentId && <NowPlayingScreen key="player" onClose={closePlayer} onOpenQueue={nav.openQueue} />}
            {overlay.queue && <QueueScreen key="queue" onClose={closeQueue} />}
          </AnimatePresence>
        </LocalBoundary>

        <LocalBoundary resetKey={`${settingsOpen}${summaryOpen}${details?.phraseId}${addTo}${create?.rename}${phraseForm?.editId ?? phraseForm !== null}`} quiet onError={closeSheets}>
          <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <SessionSummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} />
          <PhraseDetailsSheet details={details} onClose={() => setDetails(null)} />
          <AddToSetSheet phraseIds={addTo} onClose={() => setAddTo(null)} />
          <CreateSetSheet request={create} onClose={() => setCreate(null)} />
          <AddPhraseSheet request={phraseForm} onClose={() => setPhraseForm(null)} />
        </LocalBoundary>
      </div>
    </NavContext.Provider>
  );
}
