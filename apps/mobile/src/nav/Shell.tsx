// The app shell (the web prototype's App.tsx Shell): the prototype's own Navigation interface over
// expo-router, the sheets every screen can open, and the moments that get a message of their own
// (a phrase learned, a pass through the queue, a save that didn't reach storage).
import { usePathname, useRouter, useGlobalSearchParams } from 'expo-router';
import { createContext, ReactNode, RefObject, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { learnedCue } from '@shared/audio/cues';
import { setVoiceChoices } from '@shared/audio/speech';
import { NavContext, Navigation, Shareable } from '@shared/nav/NavContext';
import { formatRoute, Route, Tab } from '@shared/nav/routes';
import { findPhrase, findSetView } from '@shared/state/catalog';
import { clock } from '@shared/state/clock';
import { derive, POINTS } from '@shared/state/memory';
import { continuation, displayLearner } from '@shared/state/selectors';
import { useLatest } from '@shared/lib/useLatest';
import { added } from '@shared/generate/deck';
import type { MakeSession } from '@shared/generate/session';
import { AddPhraseSheet } from '../sheets/AddPhraseSheet';
import { AddSheet } from '../sheets/AddSheet';
import { AddToSetSheet } from '../sheets/AddToSetSheet';
import { MakeSongRequest, MakeSongSheet } from '../sheets/MakeSongSheet';
import { ShareSheet } from '../sheets/ShareSheet';
import { CreateSetSheet } from '../sheets/CreateSetSheet';
import { PhraseDetailsSheet } from '../sheets/PhraseDetailsSheet';
import { SessionSummarySheet } from '../sheets/SessionSummarySheet';
import { SettingsSheet } from '../sheets/SettingsSheet';
import { useQueueFollowsContent } from '../state/queueFollowsContent';
import { useDeviceUpload } from '../state/upload';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';

/** The tab a path belongs to; a set page belongs to the tab it was opened from. */
export function tabOfPath(pathname: string, from: string | undefined): Tab {
  if (pathname.startsWith('/explore')) return 'explore';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/music')) return 'library';
  if (pathname.startsWith('/create')) return 'create';
  const tabs: string[] = ['home', 'explore', 'library', 'create'];
  if (pathname.startsWith('/set/')) return from && tabs.includes(from) ? (from as Tab) : 'home';
  if (pathname.startsWith('/album/')) return from && tabs.includes(from) ? (from as Tab) : 'library';
  return 'home';
}

/** An expo-router href for one of the prototype's routes (its hash form without the "#"). */
export function hrefOf(route: Route): string {
  const hash = formatRoute(route).replace(/^#/, '');
  return hash === '/' ? '/' : hash;
}

interface ShellValue {
  /** What Make a set holds as it closes, so phrases added but not saved can be offered back. */
  makeSessionRef: RefObject<MakeSession | null>;
  /** Library's "+": what a learner can add. */
  openAdd: () => void;
  /** The current tab, for the tab bar and the set page's Back. */
  tab: Tab;
}

const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside the shell');
  return value;
}

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const { state, actions } = useStore();
  useEffect(() => setVoiceChoices(state.prefs.voiceByLang), [state.prefs.voiceByLang]);

  const [details, setDetails] = useState<{ phraseId: string; ownSetId?: string } | null>(null);
  const [addTo, setAddTo] = useState<string[] | null>(null);
  const [create, setCreate] = useState<{ phraseIds: string[]; rename?: string } | null>(null);
  const [phraseForm, setPhraseForm] = useState<{ editId?: string; target?: string } | null>(null);
  const [settings, setSettings] = useState<{ atVoices: boolean } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [songRequest, setSongRequest] = useState<MakeSongRequest | null>(null);
  const [sharing, setSharing] = useState<Shareable | null>(null);
  const makeSessionRef = useRef<MakeSession | null>(null);

  const tab = tabOfPath(pathname, from);
  const tabRef = useLatest(tab);
  const pathRef = useLatest(pathname);
  const learnerRef = useLatest(state.learner);
  const playerRef = useLatest(state.player);

  const nav: Navigation = useMemo(
    () => ({
      go: (route) => router.navigate(hrefOf(route) as never),
      openSet: (setId) => {
        // A page opened from the player or Make a set (a set just made there) shows in its place.
        if ((pathRef.current === '/player' || pathRef.current === '/queue' || pathRef.current === '/make') && router.canDismiss()) router.dismissAll();
        router.push({ pathname: '/set/[id]', params: { id: setId, from: tabRef.current } });
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
        // Another queue is going: play this phrase now and keep that queue after it.
        if (player.order.length > 0 && player.setId !== view?.id) {
          if (player.order[player.index] === phraseId) return actions.jump(player.index, true);
          const later = player.order.indexOf(phraseId, player.index + 1);
          if (later !== -1) return actions.jump(later, true);
          actions.restoreUpNext([phraseId], 0);
          actions.jump(player.index + 1, true);
          return;
        }
        if (view) actions.load(view.phraseIds, view.id, view.phraseIds.indexOf(phraseId));
        else actions.load([phraseId], null, 0);
      },
      playList: (phraseIds, startIndex = 0, source) => actions.load(phraseIds, null, startIndex, false, source ?? null),
      openPlayer: () => router.push('/player'),
      openQueue: () => router.push('/queue'),
      openSummary: () => setSummaryOpen(true),
      showDetails: (phraseId, context = {}) => setDetails({ phraseId, ...context }),
      addToSet: (phraseIds) => setAddTo(phraseIds),
      addPhrase: (options = {}) => setPhraseForm(options),
      createSet: (phraseIds = [], rename) => setCreate({ phraseIds, rename }),
      makeSet: (options = {}) => {
        makeSessionRef.current = null;
        router.push({ pathname: '/make', params: { ...(options.input ? { input: options.input } : {}), ...(options.setId ? { setId: options.setId } : {}) } });
      },
      openAlbum: (albumId) => {
        if ((pathRef.current === '/song' || pathRef.current === '/player') && router.canDismiss()) router.dismissAll();
        // An album opens in the tab it was opened from (Library's albums, Create, a set, Home).
        router.push({ pathname: '/album/[id]', params: { id: albumId, from: tabRef.current } });
      },
      makeSong: (options = {}) => setSongRequest(options),
      share: (item) => setSharing(item),
      openAccount: () => {
        setSettings(null);
        router.push('/account');
      },
      openSettings: () => setSettings({ atVoices: false }),
      openVoiceSettings: () => setSettings({ atVoices: true }),
    }),
    [actions, router, pathRef, tabRef, learnerRef, playerRef],
  );
  const shell = useMemo(() => ({ makeSessionRef, openAdd: () => setAddOpen(true), tab }), [tab]);

  useCelebrations(nav);
  useSaveWarning();
  useDeviceUpload();
  useQueueFollowsContent();

  return (
    <NavContext.Provider value={nav}>
      <ShellContext.Provider value={shell}>
        {children}
        <SettingsSheet open={settings !== null} atVoices={settings?.atVoices ?? false} onClose={() => setSettings(null)} />
        <SessionSummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} />
        <PhraseDetailsSheet details={details} onClose={() => setDetails(null)} />
        <AddToSetSheet phraseIds={addTo} onClose={() => setAddTo(null)} />
        <CreateSetSheet request={create} onClose={() => setCreate(null)} />
        <AddPhraseSheet request={phraseForm} onClose={() => setPhraseForm(null)} />
        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
        <MakeSongSheet request={songRequest} onClose={() => setSongRequest(null)} />
        <ShareSheet item={sharing} onClose={() => setSharing(null)} />
      </ShellContext.Provider>
    </NavContext.Provider>
  );
}

/** Make a set closed with phrases added but not saved: they are one tap from coming back. */
export function useCloseMake() {
  const c = useCopy();
  const { toast } = useToast();
  const { makeSessionRef } = useShell();
  const router = useRouter();
  return () => {
    const unsaved = makeSessionRef.current;
    makeSessionRef.current = null;
    const count = unsaved?.deck ? added(unsaved.deck).length : 0;
    if (unsaved && count > 0) {
      toast(c.make.unsaved(count), {
        action: {
          label: c.make.reopen,
          run: () => {
            makeSessionRef.current = unsaved;
            router.push({ pathname: '/make', params: { resume: '1' } });
          },
        },
      });
    }
  };
}

/** Learned bonuses and completed passes get a moment of their own (the web's useCelebrations). */
function useCelebrations(nav: Navigation) {
  const c = useCopy();
  const { state } = useStore();
  const { toast } = useToast();
  const learned = derive(state.learner.log).learnedBonuses.size;
  const passes = state.player.session?.passes ?? 0;
  const setId = state.player.setId;
  const sessionId = state.player.session?.id;
  const nextSet = findSetView(state.learner, setId)?.title;
  const seen = useRef({ learned, passes, setId, sessionId });
  useEffect(() => {
    if (learned > seen.current.learned) {
      learnedCue();
      toast(c.toast.learned(POINTS.learned), { tone: 'success' });
    }
    if (passes > seen.current.passes) {
      const next = continuation(displayLearner(state), state.player, clock.now());
      const view = next?.setId ? findSetView(state.learner, next.setId) : undefined;
      toast(c.toast.passComplete, {
        action: { label: c.player.summary, run: nav.openSummary },
        also: view && next ? { label: c.player.end.continueSet(view.title), run: () => nav.playSet(view.id, { phraseIds: next.phraseIds }) } : undefined,
      });
    }
    if (nextSet && setId !== seen.current.setId && sessionId !== undefined && sessionId === seen.current.sessionId) toast(c.toast.nextSet(nextSet));
    seen.current = { learned, passes, setId, sessionId };
    // Only when these change: the pass's offer is read from the state of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learned, passes, setId, sessionId, nextSet]);
}

/** A save that fails is said once, never silently dropped. */
function useSaveWarning() {
  const c = useCopy();
  const { saveProblem } = useStore();
  const { toast } = useToast();
  const warned = useRef(false);
  useEffect(() => {
    if (!saveProblem || warned.current) return;
    warned.current = true;
    toast(saveProblem === 'full' ? c.toast.storageFull : saveProblem === 'outdated' ? c.toast.outdated : c.toast.storageUnavailable);
  }, [saveProblem, c, toast]);
}
