// Library (the web prototype's src/screens/LibraryScreen.tsx): the learner's phrases and sets as
// filtered lists, like a music library, then their progress. The chosen list lives in the route.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNav } from '@shared/nav/NavContext';
import type { LibraryView } from '@shared/nav/routes';
import { coursePhrases, findPhrase, findSetView, ownPhrases, SetView } from '@shared/state/catalog';
import { librarySets } from '@shared/content';
import { LEARNED_MIN_SUCCESSES, LEARNED_STABILITY_DAYS } from '@shared/state/memory';
import {
  displayLearner,
  duePhraseIds,
  learnedIds,
  learnedPerWeek,
  learnerStats,
  learningIds,
  likedPhraseIds,
  likedSetIds,
  likedSetView,
  phraseProgress,
  recallBuckets,
  recentlyMissedIds,
  setProgress,
} from '@shared/state/selectors';
import type { LibraryListView } from '@shared/state/types';
import { hrefOf } from '../nav/Shell';
import { Press } from '../ui/Press';
import { AlbumsView } from './AlbumsView';
import { useAccount } from '../state/account';
import { onDevice } from '../state/upload';
import { useCopy, useNow, useStore } from '../state/store';
import { Banner } from '../ui/Banner';
import { Button, Chip } from '../ui/Button';
import { RecallChart, WeeklyChart } from '../ui/Charts';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetRow } from '../ui/SetRow';
import { StatTile } from '../ui/StatTile';
import { TopBar } from '../ui/TopBar';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow, TARGET } from '../ui/theme';

const PHRASE_VIEWS: LibraryView[] = ['liked', 'mine', 'due', 'learning', 'missed', 'learned'];
const SET_VIEWS: LibraryView[] = ['ownSets', 'likedSets'];
const PAGE_PAD = 16;

export function LibraryScreen({ view: chosen }: { view?: LibraryView }) {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const { state } = useStore();
  const now = useNow(30_000);
  const page = useRef<ScrollView>(null);
  // Ratings still in their undo window count in every list and figure here.
  const learner = displayLearner(state);
  // Sets in the learner's account and the ones they saved (plan 106).
  const yourSetIds = librarySets(learner.profile.targetLang).map((s) => s.id);
  // Made on this device before it lived in the account (plan 108): kept once they sign in.
  const waiting = onDevice(state.learner);
  const signedOut = useAccount().status !== 'signedIn';
  const stats = learnerStats(learner, now);
  // Opened without a view: what's useful now (reviews due, then liked, then what you've started),
  // chosen once, so it doesn't switch under the learner as phrases fall due.
  const [firstPhraseView] = useState<LibraryView>(() =>
    duePhraseIds(learner, now).length > 0 ? 'due' : likedPhraseIds(learner).length > 0 ? 'liked' : learningIds(learner, now).length > 0 ? 'learning' : 'liked',
  );
  const view = chosen ?? firstPhraseView;
  const segment = view === 'albums' ? 'albums' : SET_VIEWS.includes(view) ? 'sets' : 'phrases';
  const views = segment === 'sets' ? SET_VIEWS : PHRASE_VIEWS;
  const go = (next: LibraryView) => router.navigate(hrefOf({ name: 'library', view: next }) as never);

  const phraseIds: Record<string, () => string[]> = {
    liked: () => likedPhraseIds(learner),
    mine: () => ownPhrases(learner).map((p) => p.id),
    due: () => duePhraseIds(learner, now),
    learning: () => learningIds(learner, now),
    missed: () => recentlyMissedIds(learner, now),
    learned: () => learnedIds(learner, coursePhrases(learner).map((p) => p.id)),
  };

  // A figure under Progress opens its list, at the top of the page.
  const openList = (next: LibraryView) => {
    go(next);
    page.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.screen}>
      <TopBar title={c.nav.library} onOpenSettings={nav.openSettings} />
      <ScrollView ref={page} contentContainerStyle={styles.content}>
        <View style={styles.segments} accessibilityRole="tablist">
          {(['phrases', 'sets', 'albums'] as const).map((s) => {
            const on = segment === s;
            return (
              <Press
                key={s}
                accessibilityRole="tab"
                haptic={on ? 'none' : 'select'}
                accessibilityState={{ selected: on }}
                aria-selected={on}
                // The segment already shown keeps its view (Missed stays Missed).
                onPress={() => !on && go(s === 'albums' ? 'albums' : s === 'sets' ? 'ownSets' : firstPhraseView)}
                style={[styles.segment, on && styles.segmentOn]}
              >
                <Txt weight={on ? 700 : 500} color={on ? 'onSurface' : 'secondary'}>
                  {s === 'albums' ? c.library.albumsSegment : s === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
                </Txt>
              </Press>
            );
          })}
        </View>

        {signedOut && waiting.phrases.length + waiting.sets.length > 0 && (
          <Banner action={<Button variant="primarySm" label={c.account.signIn} onPress={nav.openAccount} />} style={styles.onDevice}>
            <Txt variant="label">{c.library.onDevice(waiting.phrases.length, waiting.sets.length)}</Txt>
          </Banner>
        )}

        {segment === 'albums' ? (
          <AlbumsView />
        ) : (
          <>
        {/* One line of filters that scrolls, never two or three lines of wrapped chips. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel={segment === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
          style={styles.bleed}
          contentContainerStyle={styles.chipRow}
        >
          {views.map((v) => (
            <Chip key={v} label={c.library.filters[v]} selected={view === v} onPress={() => go(v)} />
          ))}
        </ScrollView>

        <View>
          {segment === 'phrases' ? (
            <PhraseList ids={phraseIds[view]()} view={view} now={now} />
          ) : (
            <SetList ids={view === 'ownSets' ? yourSetIds : likedSetIds(learner)} view={view} now={now} liked={view === 'ownSets'} />
          )}
          {view === 'mine' && (
            <View style={styles.actions}>
              <Button variant="tonal" icon="add" label={c.library.addPhrase} onPress={() => nav.addPhrase()} />
            </View>
          )}
          {view === 'ownSets' && (
            <View style={styles.actions}>
              <Button variant="tonal" icon="add" label={c.library.newSet} onPress={() => nav.createSet()} />
              <Button variant="tonal" icon="auto_awesome" label={c.make.title} onPress={() => nav.makeSet()} />
            </View>
          )}
        </View>

        <View style={styles.progress}>
          <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
            {c.library.progress}
          </Txt>
          <StatTile
            layout="horizontal"
            label={c.library.learned}
            value={String(stats.learned)}
            note={c.library.learnedNote(LEARNED_STABILITY_DAYS, LEARNED_MIN_SUCCESSES)}
            onPress={() => openList('learned')}
          />
          <StatTile
            layout="horizontal"
            label={c.library.recall}
            value={stats.averageRecall === null ? '—' : `${stats.averageRecall}%`}
            note={stats.averageRecall === null ? c.library.recallNone : c.library.recallNote(stats.rated)}
            onPress={() => openList('learning')}
          />
          <StatTile layout="horizontal" label={c.library.started} value={String(stats.started)} note={c.library.startedNote} onPress={() => openList('learning')} />
          <RecallChart buckets={recallBuckets(learner, now)} />
          <WeeklyChart weeks={learnedPerWeek(learner, now)} />
        </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PhraseList({ ids, view, now }: { ids: string[]; view: LibraryView; now: number }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const learner = displayLearner(state);
  const empty =
    view === 'learned'
      ? c.library.empty.learned(LEARNED_STABILITY_DAYS, LEARNED_MIN_SUCCESSES)
      : c.library.empty[view as Exclude<LibraryView, 'learned' | 'ownSets' | 'likedSets' | 'albums'>];
  if (ids.length === 0) return <Txt color="secondary" style={styles.empty}>{empty}</Txt>;
  const source = { kind: 'library' as const, view: view as LibraryListView };
  return (
    <>
      {/* The list's header: how many, and the one filled button on the page. */}
      <View style={styles.listHead}>
        <Txt variant="label" weight={600} color="secondary">
          {c.common.phrases(ids.length)}
        </Txt>
        <Button variant="primarySm" icon="play_arrow" iconFill label={c.library.playAll(ids.length)} onPress={() => nav.playList(ids, 0, source)} />
      </View>
      <View style={styles.rows}>
        {ids.map((id, i) => {
          const phrase = findPhrase(state.learner, id);
          if (!phrase) return null;
          return (
            <PhraseRow
              key={id}
              phrase={phrase}
              detail={progressLabel(c, phraseProgress(learner, id, now), now)}
              onPlay={() => nav.playList(ids, i, source)}
              onMore={() => nav.showDetails(id)}
            />
          );
        })}
      </View>
    </>
  );
}

/** Sets as rows; `liked` puts the learner's own "Liked phrases" first, which every learner has. */
function SetList({ ids, view, now, liked = false }: { ids: string[]; view: LibraryView; now: number; liked?: boolean }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const learner = displayLearner(state);
  const sets = [...(liked ? [likedSetView(state.learner, c.library.likedPhrases)] : []), ...ids.map((id) => findSetView(state.learner, id)).filter((v): v is SetView => Boolean(v))];
  if (sets.length === 0) return <Txt color="secondary" style={styles.empty}>{c.library.empty[view as 'ownSets' | 'likedSets']}</Txt>;
  return (
    <>
      <View style={styles.listHead}>
        <Txt variant="label" weight={600} color="secondary">
          {c.common.sets(sets.length)}
        </Txt>
      </View>
      {sets.map((v) => {
        const progress = setProgress(learner, v.phraseIds, now);
        return <SetRow key={v.id} set={v} meta={c.set.summary(progress.total, progress.learned, progress.due)} onOpen={() => nav.openSet(v.id)} />;
      })}
    </>
  );
}

const styles = StyleSheet.create({
  onDevice: { borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLow, padding: 12 },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: PAGE_PAD, paddingTop: 16, paddingBottom: 24, gap: 12 },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow },
  segment: { flex: 1, minHeight: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surfaceContainerLowest, ...shadow.card },
  bleed: { marginHorizontal: -PAGE_PAD, marginTop: -4 },
  chipRow: { paddingHorizontal: PAGE_PAD, gap: 8 },
  listHead: { minHeight: TARGET, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  rows: { marginHorizontal: -8 },
  empty: { paddingVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  progress: { marginTop: 20, gap: 8 },
});
