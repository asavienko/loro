// Home (the web prototype's src/screens/HomeScreen.tsx): exactly one hero, the first that applies
// (the demo, the review, what to continue, the course done), quiet figures, then what else there is.
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Album, albumsForCourse } from '@shared/content';
import { greeting } from '@shared/copy';
import { useNav } from '@shared/nav/NavContext';
import { coursePhrases, courseSets, findSetView } from '@shared/state/catalog';
import { formatAgo, formatElapsed, formatWhen } from '@shared/state/clock';
import {
  displayLearner,
  duePhraseIds,
  learnerStats,
  listDurationMs,
  nextDue,
  notStartedSets,
  playableIds,
  playedSets,
  recentSetIds,
  reviewQueue,
  setProgress,
  suggestedSetId,
  todayCounts,
} from '@shared/state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { AlbumCover } from '../music/AlbumCover';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SetCard } from '../ui/SetCard';
import { SetRow } from '../ui/SetRow';
import { Sheet } from '../ui/Sheet';
import { StatChip } from '../ui/StatTile';
import { TopBar } from '../ui/TopBar';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function HomeScreen() {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const now = useNow(30_000);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Ratings still in their undo window count in every figure here (not in points).
  const learner = displayLearner(state);
  const stats = learnerStats(learner, now);
  const today = todayCounts(state, now);
  const due = duePhraseIds(learner, now);
  const review = reviewQueue(learner, now);
  const reviewMs = listDurationMs(state, review);
  const upcoming = nextDue(learner, now);
  const suggestedId = suggestedSetId(learner, now);
  const suggested = findSetView(learner, suggestedId);
  const suggestedIds = suggested ? playableIds(learner, suggested.phraseIds, now) : [];
  const suggestedProgress = suggested ? setProgress(learner, suggested.phraseIds, now) : null;
  const recent = recentSetIds(learner).filter((id) => id !== suggestedId);
  const fresh = notStartedSets(learner, now).filter((s) => s.id !== suggestedId);
  const firstRun = stats.started === 0;
  const firstPhrase = courseSets(learner)[0]?.phraseIds[0];
  const newToLoro = !state.prefs.skippedDemo && !state.learner.log.some((entry) => entry.kind === 'heard');
  const offerDemo = newToLoro && Boolean(firstPhrase) && state.player.source?.kind !== 'demo';
  const courseTotal = coursePhrases(learner).length;
  const courseDone = courseTotal > 0 && due.length === 0 && suggestedIds.length === 0 && stats.learned === courseTotal;
  const hero = offerDemo && firstPhrase ? 'demo' : due.length > 0 ? 'review' : suggested && suggestedIds.length > 0 ? 'continue' : courseDone ? 'done' : null;
  const continueTitle = stats.started === 0 ? c.home.startTitle : suggestedProgress?.started === 0 ? c.home.nextTitle : c.home.continueTitle;
  const continueMeta = suggestedProgress ? c.set.summary(suggestedProgress.total, suggestedProgress.learned, suggestedProgress.due) : '';
  // Home's study plays open the player, as the demo does, so the learner sees the grades to rate.
  const playContinue = () => {
    if (!suggested) return;
    nav.playSet(suggested.id, { phraseIds: suggestedIds });
    nav.openPlayer();
  };
  const nextLine = upcoming && due.length <= review.length ? (review.length > 0 ? c.home.nextAfter : c.home.next)(upcoming.count, formatWhen(upcoming.at, now, c.locale)) : null;
  const { name, targetLang } = state.learner.profile;

  const album = albumsForCourse(targetLang).find((a) => a.owner === 'loro' && a.songCount > 0);
  return (
    <View style={styles.screen}>
      <TopBar title={greeting(targetLang, name)} titleLang={targetLang} onOpenSettings={nav.openSettings} />
      <ScrollView contentContainerStyle={styles.content}>
        {newToLoro && <Txt color="secondary">{c.home.firstRun}</Txt>}

        {hero === 'demo' && firstPhrase && (
          <Hero>
            <Txt variant="label" weight={600} color="onPrimaryFixed" accessibilityRole="header">
              {c.home.demoTitle}
            </Txt>
            <Txt variant="displaySm" face="serif" weight={600} style={styles.heroTitle}>
              {c.home.demoBody}
            </Txt>
            <PlayButton
              label={c.home.demoButton}
              detail={null}
              onPress={() => {
                nav.playList([firstPhrase], 0, { kind: 'demo' });
                nav.openPlayer();
              }}
            />
          </Hero>
        )}

        {hero === 'review' && (
          <Hero>
            <Txt variant="label" weight={600} color="onPrimaryFixed" accessibilityRole="header">
              {c.home.reviewTitle}
            </Txt>
            <Txt variant="displaySm" face="serif" weight={600} style={styles.heroTitle}>
              {c.home.reviewBody(due.length)}
            </Txt>
            {due.length > review.length && <Txt color="onSurfaceVariant">{c.home.reviewCapped(review.length)}</Txt>}
            <PlayButton
              label={c.home.playPhrases(review.length)}
              detail={reviewMs === null ? null : c.home.duration(formatElapsed(reviewMs))}
              onPress={() => {
                nav.playList(review, 0, { kind: 'review' });
                nav.openPlayer();
              }}
            />
            {nextLine && <NextLine text={nextLine} />}
          </Hero>
        )}

        {hero === 'continue' && suggested && (
          <Hero>
            <Txt variant="label" weight={600} color="onPrimaryFixed" accessibilityRole="header">
              {continueTitle}
            </Txt>
            <View style={styles.heroSet}>
              <SetRow set={suggested} meta={continueMeta} onOpen={() => nav.openSet(suggested.id)} />
            </View>
            <PlayButton label={c.home.playPhrases(suggestedIds.length)} detail={null} onPress={playContinue} />
          </Hero>
        )}

        {hero === 'done' && (
          <Hero tone="tertiary">
            <Icon name="task_alt" size="xl" color="tertiary" />
            <Txt variant="displaySm" face="serif" weight={600} accessibilityRole="header">
              {c.home.courseDoneTitle}
            </Txt>
            <Txt color="onSurfaceVariant">{c.home.courseDoneBody}</Txt>
            <Button variant="primary" icon="add" label={c.home.addOwn} onPress={() => nav.addPhrase()} style={styles.heroButton} />
            <Button variant="tonal" label={c.home.otherCourse} onPress={nav.openSettings} />
          </Hero>
        )}

        {/* Behind a demo or a review, what to continue is a row with a quiet Play of its own. */}
        {hero !== 'continue' && suggested && suggestedIds.length > 0 && (
          <View>
            <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
              {continueTitle}
            </Txt>
            <SetRow
              set={suggested}
              meta={continueMeta}
              onOpen={() => nav.openSet(suggested.id)}
              action={
                <Button
                  variant="icon"
                  icon="play_arrow"
                  iconFill
                  accessibilityLabel={c.home.playPhrases(suggestedIds.length)}
                  onPress={playContinue}
                  style={{ backgroundColor: colors.surfaceContainerHigh }}
                />
              }
            />
          </View>
        )}

        {/* Quiet figures: none on a first run (zeros say nothing). */}
        {(!firstRun || today.heard + today.rated > 0 || (nextLine && hero !== 'review')) && (
          <View style={styles.figures}>
            {!firstRun && (
              <View style={styles.chips}>
                <StatChip label={c.home.learned} value={stats.learned} icon="verified" onPress={() => nav.go({ name: 'library', view: 'learned' })} />
                <StatChip label={c.home.started} value={stats.started} icon="headphones" onPress={() => nav.go({ name: 'library', view: 'learning' })} />
              </View>
            )}
            {today.heard + today.rated > 0 && (
              <Txt variant="label" color="secondary">
                {c.home.today(today.heard, today.rated)}
              </Txt>
            )}
            {nextLine && hero !== 'review' && <NextLine text={nextLine} />}
          </View>
        )}

        {recent.length > 0 && (
          <View>
            <View style={styles.sectionHead}>
              <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
                {c.home.jumpBackIn}
              </Txt>
              <Button variant="text" icon="history" label={c.home.history} onPress={() => setHistoryOpen(true)} />
            </View>
            {recent.map((id) => {
              const view = findSetView(learner, id);
              if (!view) return null;
              const progress = setProgress(learner, view.phraseIds, now);
              return <SetRow key={id} set={view} meta={c.set.summary(progress.total, progress.learned, progress.due)} onOpen={() => nav.openSet(view.id)} />;
            })}
          </View>
        )}

        {fresh.length > 0 && (
          <View>
            <Txt variant="heading" face="serif" weight={600} accessibilityRole="header" style={styles.shelfTitle}>
              {c.home.notStarted}
            </Txt>
            {/* A shelf: it scrolls sideways, never squeezes. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf} style={styles.shelfScroll}>
              {fresh.map((set) => {
                const view = findSetView(learner, set.id)!;
                return <SetCard key={set.id} view={view} progress={setProgress(learner, set.phraseIds, now)} onOpen={() => nav.openSet(set.id)} onPlay={() => nav.playSet(set.id)} />;
              })}
            </ScrollView>
          </View>
        )}

        {/* The course sung (plan 106): the way to the music side, in its night colours. */}
        {album && !newToLoro && <AlbumTeaser album={album} onOpen={() => nav.openAlbum(album.id)} />}

        {recent.length === 0 && !firstRun && <Button variant="text" icon="history" label={c.home.history} onPress={() => setHistoryOpen(true)} style={styles.start} />}
      </ScrollView>
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} now={now} />
    </View>
  );
}

/** The one hero on Home: a wash, no border, and one full-width Play. */
function Hero({ tone = 'primary', children }: { tone?: 'primary' | 'tertiary'; children: ReactNode }) {
  return <View style={[styles.hero, { backgroundColor: tone === 'tertiary' ? 'rgba(214,233,193,0.6)' : 'rgba(255,219,207,0.45)' }]}>{children}</View>;
}

function PlayButton({ label, detail, onPress }: { label: string; detail: string | null; onPress: () => void }) {
  return (
    <Button variant="primary" icon="play_arrow" iconFill label={detail ? `${label}\u00a0· ${detail}` : label} onPress={onPress} style={styles.heroButton} />
  );
}

function AlbumTeaser({ album, onOpen }: { album: Album; onOpen: () => void }) {
  const c = useCopy();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${album.title}, ${c.music.songs(album.songCount)}`} onPress={onOpen} style={({ pressed }) => [styles.teaser, pressed && { opacity: 0.9 }]}>
      <AlbumCover url={album.coverUrl} px={64} rounded={10} />
      <View style={styles.flex}>
        <Txt variant="label" weight={700} color="nightAccent">
          {c.music.title.toLocaleUpperCase(c.locale)}
        </Txt>
        <Txt variant="row" weight={700} color="onNight" numberOfLines={1}>
          {album.title}
        </Txt>
        <Txt variant="label" color="onNightVariant" numberOfLines={2}>
          {`${c.music.songs(album.songCount)} · ${c.music.loroAlbum}`}
        </Txt>
      </View>
      <Icon name="chevron_right" color="onNight" />
    </Pressable>
  );
}

function NextLine({ text }: { text: string }) {
  return (
    <View style={styles.nextLine}>
      <Icon name="schedule" size="xs" color="secondary" />
      <Txt variant="label" color="secondary" style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

/** History as the sets that were played, newest first. */
function HistorySheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const runs = open ? playedSets(state.learner) : [];
  return (
    <Sheet open={open} title={c.history.title} onClose={onClose}>
      {runs.length === 0 ? (
        <Txt color="secondary">{c.history.empty}</Txt>
      ) : (
        runs.map((run) => {
          const view = findSetView(state.learner, run.setId);
          return (
            <SetRow
              key={`${run.setId}-${run.from}`}
              set={view ?? { title: c.history.mixed, topicId: null, coverIcon: 'queue_music' }}
              meta={`${c.history.run(run.phrases, run.points)} · ${formatAgo(run.to, now, c.locale)}`}
              disabled={!view}
              onOpen={() => {
                if (!view) return;
                onClose();
                nav.openSet(view.id);
              }}
            />
          );
        })
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  teaser: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius['2xl'], backgroundColor: colors.night },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, gap: 28, width: '100%', maxWidth: 672, alignSelf: 'center' },
  hero: { borderRadius: radius['2xl'], padding: 20, gap: 4 },
  heroTitle: { marginTop: 2 },
  heroSet: { marginTop: 4, marginHorizontal: 8 },
  heroButton: { marginTop: 16, borderRadius: radius['3xl'], minHeight: TARGET + 4 },
  figures: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  shelfTitle: { marginBottom: 8 },
  shelfScroll: { marginHorizontal: -16 },
  shelf: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  nextLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  flex: { flex: 1 },
  start: { alignSelf: 'flex-start', marginLeft: -12 },
});
