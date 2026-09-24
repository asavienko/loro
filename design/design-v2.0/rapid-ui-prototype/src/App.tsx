import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { getPhrase, getSet } from './content';
import { usePlaybackDriver } from './audio/usePlaybackDriver';
import { stopSpeech } from './audio/speech';
import { clearSavedState } from './state/persistence';
import { StoreProvider, useCurrentPhraseId, useStore } from './state/store';
import { NavigationHeader } from './components/NavigationHeader';
import { BottomNavBar, Tab } from './components/BottomNavBar';
import { MiniPlayer } from './components/MiniPlayer';
import { PhraseDetailsSheet } from './components/PhraseDetailsSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { HomeScreen } from './screens/HomeScreen';
import { SetScreen } from './screens/SetScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { QueueScreen } from './screens/QueueScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { LibraryScreen } from './screens/LibraryScreen';

type Overlay = 'player' | 'queue' | null;

export interface Navigation {
  openSet: (setId: string) => void;
  /** Play a whole set from its first phrase. */
  playSet: (setId: string) => void;
  /** Play a phrase within its own set, from that phrase onwards. */
  playPhraseInSet: (phraseId: string) => void;
  /** Play an explicit list (reviews, saved phrases). */
  playList: (phraseIds: string[], startIndex?: number) => void;
  showDetails: (phraseId: string) => void;
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

/** Last resort if saved progress no longer fits the app: say so and offer a clean start. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-dvh bg-surface text-on-surface flex flex-col justify-center gap-3 px-6 max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold">Loro couldn’t open your progress</h1>
        <p className="text-sm text-secondary">
          The progress saved on this device doesn’t match this version of the app. Resetting it starts you from
          zero on this device.
        </p>
        <button
          type="button"
          onClick={() => {
            clearSavedState();
            window.location.reload();
          }}
          className="self-start min-h-12 px-5 rounded-full bg-primary-container text-on-primary font-bold"
        >
          Reset progress
        </button>
      </main>
    );
  }
}

const TAB_TITLES: Record<Tab, string | undefined> = {
  home: undefined,
  explore: 'Explore',
  library: 'Library',
};

function Shell() {
  usePlaybackDriver();
  const { actions } = useStore();
  const currentId = useCurrentPhraseId();
  const [tab, setTab] = useState<Tab>('home');
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => stopSpeech, []);

  const openPlayer = useCallback(() => setOverlay('player'), []);

  const nav: Navigation = {
    openSet: (setId) => {
      setOpenSetId(setId);
      window.scrollTo(0, 0);
    },
    playSet: (setId) => actions.load(getSet(setId).phraseIds, setId, 0),
    playPhraseInSet: (phraseId) => {
      const set = getSet(getPhrase(phraseId).setId);
      actions.load(set.phraseIds, set.id, set.phraseIds.indexOf(phraseId));
    },
    playList: (phraseIds, startIndex = 0) => actions.load(phraseIds, null, startIndex),
    showDetails: setDetailsId,
  };

  const goTab = (next: Tab) => {
    setOpenSetId(null);
    setTab(next);
    window.scrollTo(0, 0);
  };

  const screenKey = openSetId ? `set-${openSetId}` : tab;
  // Behind a full-screen overlay the app is neither focusable nor read out.
  const behind = overlay !== null;

  return (
    <div className="min-h-dvh bg-surface text-on-surface flex flex-col antialiased">
      <NavigationHeader
        title={openSetId ? undefined : TAB_TITLES[tab]}
        onBack={openSetId ? () => setOpenSetId(null) : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
        inert={behind}
      />

      <main inert={behind} className="flex-1 pt-[calc(56px+env(safe-area-inset-top))] pb-[calc(140px+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {openSetId ? (
              <SetScreen setId={openSetId} nav={nav} />
            ) : tab === 'home' ? (
              <HomeScreen nav={nav} />
            ) : tab === 'explore' ? (
              <ExploreScreen nav={nav} />
            ) : (
              <LibraryScreen nav={nav} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {currentId && (
        // Stays mounted under the player so focus can return to it on close.
        <div
          inert={behind}
          className={`fixed inset-x-2 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 max-w-lg mx-auto ${behind ? 'invisible' : ''}`}
        >
          <MiniPlayer onOpenPlayer={openPlayer} />
        </div>
      )}

      <BottomNavBar current={tab} onNavigate={goTab} inert={behind} />

      <AnimatePresence>
        {overlay === 'player' && currentId && (
          <NowPlayingScreen
            key="player"
            onClose={() => setOverlay(null)}
            onOpenQueue={() => setOverlay('queue')}
          />
        )}
        {overlay === 'queue' && (
          <QueueScreen key="queue" onClose={() => setOverlay('player')} nav={nav} />
        )}
      </AnimatePresence>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <PhraseDetailsSheet
        phraseId={detailsId}
        onClose={() => setDetailsId(null)}
        onPlay={(id) => {
          setDetailsId(null);
          nav.playPhraseInSet(id);
        }}
      />
    </div>
  );
}
