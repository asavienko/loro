// A set's page (the web prototype's src/screens/SetScreen.tsx): its cover and title on its topic's
// colour, the real summary and length, Like / More / Shuffle / Play, the play order that is also the
// sort, and its phrases. Your own set grows from here.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { keepOpenedSet } from '@shared/api/contentCache';
import { deleteSet, fetchSet, generateCover, saveItem, unsaveItem } from '@shared/api/library';
import { coursesFor, getTopic, Phrase, TopicTone } from '@shared/content';
import { languageName } from '@shared/copy';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView } from '@shared/state/catalog';
import { formatElapsed } from '@shared/state/clock';
import { currentPhraseId, displayLearner, isLiked, phraseProgress, PhraseProgress, setDurationMs, setProgress, sortFor } from '@shared/state/selectors';
import type { SortKey } from '@shared/state/types';
import { isTargetRevealed } from '@shared/ui/phase';
import { hrefOf, useShell } from '../nav/Shell';
import { pageUrl } from '../sheets/ShareSheet';
import { SongRow } from '../music/SongRow';
import { useSetSongs } from '../music/useSetSongs';
import { MoreSetsByMaker } from './MoreByMaker';
import { PickPhrasesSheet } from '../sheets/PickPhrasesSheet';
import { RenameSheet } from '../sheets/RenameSheet';
import { ReportSheet } from '../sheets/ReportSheet';
import { useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { confirm } from '../ui/confirm';
import { problemText } from '../ui/problems';
import { progressLabel } from '../ui/progressLabel';
import { SetCover } from '../ui/SetCover';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { TopBar } from '../ui/TopBar';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow, TARGET } from '../ui/theme';

const SORTS: { id: SortKey; icon: IconName }[] = [
  { id: 'set', icon: 'format_list_numbered' },
  { id: 'az', icon: 'sort_by_alpha' },
  { id: 'due', icon: 'schedule' },
  { id: 'weakest', icon: 'trending_down' },
];

const STATUS_RANK: Record<PhraseProgress['status'], number> = { due: 0, learning: 1, new: 2, learned: 3 };

/** The cover's colour as a wash behind the page's head (the web's TONE_WASH gradient start). */
const TONE_WASH: Record<TopicTone, string> = {
  primary: 'rgba(255,219,207,0.55)',
  secondary: 'rgba(234,225,219,0.7)',
  tertiary: 'rgba(214,233,193,0.55)',
};

/** Past this much scroll the page's own title is gone, and the top bar says it. */
const TITLE_SCROLL_PX = 120;

/**
 * What a set page last put in the queue, per set: the whole set or its due-and-new phrases, and in
 * which sort. The big Play resumes only a queue that is this whole set in the order shown; the
 * sorts by status reorder themselves as phrases are rated, so the order is compared with the one
 * the page loaded, in the sort it was loaded in. After a reload, the order shown is compared.
 */
const loadedHere = new Map<string, { kind: 'set' | 'dueNew'; ids: string[]; sort: SortKey }>();
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export function SetScreen({ setId }: { setId: string }) {
  const nav = useNav();
  const router = useRouter();
  const { tab } = useShell();
  const { state } = useStore();
  const [past, setPast] = useState(false);
  const view = findSetView(state.learner, setId);
  const back = () => (router.canGoBack() ? router.back() : router.navigate(hrefOf({ name: tab }) as never));
  // A set not installed here (a link, Community): fetched and kept, so its phrases play (plan 106).
  const [fetching, setFetching] = useState(!view);
  useEffect(() => {
    if (!fetching) return;
    let live = true;
    fetchSet(setId)
      .then((detail) => keepOpenedSet(detail))
      .catch(() => {})
      .finally(() => live && setFetching(false));
    return () => {
      live = false;
    };
  }, [fetching, setId]);
  return (
    <View style={styles.screen}>
      <TopBar title={past ? view?.title : undefined} onBack={back} onOpenSettings={nav.openSettings} />
      <ScrollView
        scrollEventThrottle={64}
        onScroll={(e) => {
          const now = e.nativeEvent.contentOffset.y > TITLE_SCROLL_PX;
          if (now !== past) setPast(now);
        }}
      >
        {fetching ? <ActivityIndicator color={colors.primaryContainer} style={styles.message} /> : <SetPage setId={setId} onDeleted={back} />}
      </ScrollView>
    </View>
  );
}

function SetPage({ setId, onDeleted }: { setId: string; onDeleted: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const account = useAccount();
  const content = useContent();
  const view = findSetView(state.learner, setId);
  // Songs are the server's: only a set the server serves has them.
  const setSongs = useSetSongs(view?.content ? setId : null);
  if (!view)
    return (
      <Txt color="secondary" style={styles.message}>
        {c.set.notFound}
      </Txt>
    );
  // A link or a history entry can lead to another course's set: say so rather than play it
  // into this course's progress, and offer the switch when that course is open to the learner.
  const { profile } = state.learner;
  if (view.targetLang !== profile.targetLang) {
    const language = languageName(view.targetLang, c.locale);
    return (
      <View style={[styles.message, styles.otherCourse]}>
        <Txt color="secondary">{c.set.otherCourse(language)}</Txt>
        {coursesFor(profile.nativeLang).includes(view.targetLang) && (
          <Button variant="primarySm" label={c.set.switchCourse(language)} onPress={() => actions.setProfile({ targetLang: view.targetLang })} />
        )}
      </View>
    );
  }

  const sort = sortFor(state.prefs, setId);
  const topic = view.topicId ? getTopic(view.topicId) : undefined;
  const progress = setProgress(displayLearner(state), view.phraseIds, now);
  const liked = isLiked(state.learner, 'set', setId);
  const currentId = currentPhraseId(state.player);
  const isThisSet = state.player.setId === setId;
  const playing = isThisSet && state.player.status === 'playing';
  const duration = setDurationMs(state, view);
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';

  const rows = view.phraseIds
    .map((id, i) => ({ phrase: findPhrase(state.learner, id), position: i + 1 }))
    .filter((r): r is { phrase: Phrase; position: number } => Boolean(r.phrase))
    .map((r) => ({ ...r, progress: phraseProgress(displayLearner(state), r.phrase.id, now) }));
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case 'az':
        return a.phrase.target.localeCompare(b.phrase.target, a.phrase.targetLang);
      case 'due':
        return STATUS_RANK[a.progress.status] - STATUS_RANK[b.progress.status] || a.position - b.position;
      case 'weakest':
        return (a.progress.recall ?? -1) - (b.progress.recall ?? -1) || a.position - b.position;
      default:
        return a.position - b.position;
    }
  });
  const sortedIds = sorted.map((r) => r.phrase.id);
  // What the button says: due again, or never rated (the statuses the rows show).
  const dueAndNew = sorted.filter((r) => r.progress.status === 'due' || r.progress.status === 'new').map((r) => r.phrase.id);

  const { player } = state;
  const loaded = loadedHere.get(setId);
  const queue = isThisSet ? player.baseOrder : [];
  const dueNewQueue = loaded?.kind === 'dueNew' && sameList(queue, loaded.ids);
  // What Resume would play: the queue as it stands, so a phrase removed or moved in Up next
  // means it is no longer the set in the order shown. A missed phrase's second copy aside.
  const remaining = isThisSet ? player.order.filter((id, i, all) => all.indexOf(id) === i) : [];
  const wholeSetQueue = isThisSet && ((loaded?.kind === 'set' && loaded.sort === sort && sameList(remaining, loaded.ids)) || sameList(remaining, sortedIds));
  // Paused on this whole set, in the order shown (not shuffled, not finished): Play resumes it.
  const resumes = wholeSetQueue && player.status === 'paused' && !player.shuffle && !player.ended && currentId !== null;
  // The big button pauses whatever this set is playing, except the due-and-new queue, which its own button pauses.
  const bigPauses = playing && !dueNewQueue;
  const showDueNew = (dueNewQueue && playing) || (dueAndNew.length > 0 && dueAndNew.length < sortedIds.length);

  const load = (kind: 'set' | 'dueNew', ids: string[], options: { startIndex?: number; shuffle?: boolean } = {}) => {
    loadedHere.set(setId, { kind, ids, sort });
    nav.playSet(setId, { phraseIds: ids, ...options });
  };
  const onPlay = () => {
    if (bigPauses) actions.pause();
    else if (resumes) actions.play();
    else load('set', sortedIds);
  };
  const onDueNew = () => {
    if (dueNewQueue && playing) actions.pause();
    else load('dueNew', dueAndNew);
  };

  // A set in the learner's account, or one they saved or opened (plan 106).
  const served = view.content;
  /** One of the learner's own sets (plan 108): theirs to fill and arrange. */
  const mine = served?.owner === 'me';
  const drawCover = async () => {
    if (!served) return;
    setDrawing(true);
    try {
      const cover = await generateCover({ kind: 'set', title: served.title, ...(served.description ? { description: served.description } : {}), attachTo: served.id });
      await content.refresh();
      void account.refreshUsage();
      if (cover.status === 'rendering') toast(c.share.coverLater);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setDrawing(false);
    }
  };
  const removeServed = async () => {
    if (!served || !(await confirm(c.share.deleteSetConfirm(served.title), c.share.delete, c.common.cancel))) return;
    try {
      await deleteSet(served.id);
      toast(c.share.deleted);
      await content.refresh();
      onDeleted();
    } catch (error) {
      toast(problemText(c, error));
    }
  };
  const toggleSaved = async () => {
    if (!served) return;
    if (account.status !== 'signedIn') return nav.openAccount();
    try {
      if (served.saved) await unsaveItem('set', served.id);
      else await saveItem('set', served.id);
      toast(served.saved ? c.share.unsavedToast : c.share.savedToast);
      await content.refresh();
    } catch (error) {
      toast(problemText(c, error));
    }
  };

  // The system share sheet; a browser without one copies the link instead.
  const share = async () => {
    const url = pageUrl(hrefOf({ name: 'set', id: setId, from: 'explore' }));
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        await navigator.clipboard.writeText(url);
        toast(c.set.linkCopied);
      } else await Share.share(Platform.OS === 'ios' ? { title: view.title, url } : { title: view.title, message: url });
    } catch (error) {
      // The learner cancelled the browser's share sheet; anything else means sharing failed.
      if (!(error instanceof Error && error.name === 'AbortError')) toast(c.set.copyUnavailable);
    }
  };

  const tone = (view.topicId && topic?.tone) || 'secondary';

  return (
    <>
      {/* The page takes its cover's colour, edge to edge. */}
      <View style={{ backgroundColor: TONE_WASH[tone] }}>
        <View style={styles.head}>
          {/* Cover and title side by side, whatever the title's length, so sibling sets share one
              layout; only very large text puts the title under the cover. */}
          <View style={styles.headRow}>
            <SetCover set={view} px={96} rounded={radius['2xl']} style={shadow.cover} />
            <View style={styles.headText}>
              <View style={styles.kicker}>
                {mine ? (
                  <>
                    <Icon name="edit_note" size="xs" color="secondary" />
                    <Txt variant="label" weight={600} color="secondary">
                      {c.set.own}
                    </Txt>
                  </>
                ) : (
                  topic && (
                    <>
                      <Icon name={topic.icon as IconName} size="xs" color="secondary" />
                      <Txt variant="label" weight={600} color="secondary">
                        {topic.title[locale]}
                      </Txt>
                      {view.level && (
                        <View style={styles.level}>
                          <Txt variant="label" weight={600} color="secondary">
                            {view.level}
                          </Txt>
                        </View>
                      )}
                    </>
                  )
                )}
              </View>
              <Txt variant="displaySm" face="serif" weight={600} lang={view.targetLang} accessibilityRole="header">
                {view.title}
              </Txt>
              {(view.content?.subtitle ?? view.content?.description) && (
                <Txt color="secondary" style={styles.subtitle}>
                  {view.content.subtitle?.[locale] ?? view.content.description}
                </Txt>
              )}
            </View>
          </View>
          <Txt color="secondary" style={styles.summary}>
            {c.set.summary(progress.total, progress.learned, progress.due)}
            {setSongs.songs.length > 0 ? ` · ${c.music.songs(setSongs.songs.length)}` : ''}
            {/* The duration moves to the next line whole rather than leaving "1×" alone there. */}
            {duration !== null && sortedIds.length > 0 && ` · ${c.set.duration(formatElapsed(duration)).replace(/ /g, '\u00a0')}`}
          </Txt>
          {/* Like and More on the left; Play (and shuffle) on the right, and on a line of their own
              when large text leaves no room for both. */}
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.set.like}
              accessibilityState={{ selected: liked }}
              aria-pressed={liked}
              onPress={() => actions.toggleLike('set', setId)}
              style={({ pressed }) => [styles.iconButton, styles.first, pressed && styles.pressed]}
            >
              <Icon name="favorite" fill={liked} size="lg" color="primaryContainer" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.common.moreOptions}
              onPress={() => setMoreOpen(true)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon name="more_horiz" size="lg" color="secondary" />
            </Pressable>
            {/* Where Play picks up, said beside it. */}
            {resumes && (
              <Txt variant="label" weight={600} color="secondary" align="right" style={styles.pausedAt}>
                {c.set.pausedAt(player.index + 1, player.order.length)}
              </Txt>
            )}
            <View style={styles.play}>
              {sortedIds.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={c.set.shufflePlay}
                  onPress={() => load('set', sortedIds, { shuffle: true })}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Icon name="shuffle" size="lg" color="secondary" />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={bigPauses ? c.set.pauseAll(view.title) : resumes ? c.set.resume(view.title) : c.set.playAll(view.title)}
                accessibilityState={{ disabled: sortedIds.length === 0 }}
                onPress={onPlay}
                disabled={sortedIds.length === 0}
                style={({ pressed }) => [styles.bigPlay, pressed && { transform: [{ scale: 0.95 }] }, sortedIds.length === 0 && styles.disabled]}
              >
                <Icon name={bigPauses ? 'pause' : 'play_arrow'} fill size="2xl" color="onPrimary" />
              </Pressable>
            </View>
          </View>
          {/* The play order and the sort are one control: it says the order, and changes it. An
              empty set of your own has nothing to order yet. */}
          {sortedIds.length > 0 && (
            <View style={styles.orderRow}>
              <Pressable accessibilityRole="button" onPress={() => setSortOpen(true)} style={({ pressed }) => [styles.order, pressed && styles.pressed]}>
                <Txt variant="label" weight={600} color="secondary">
                  {c.set.playsIn(c.set.sort[sort])}
                </Txt>
                <Icon name="keyboard_arrow_down" size="sm" color="secondary" />
              </Pressable>
              {showDueNew && (
                <Button
                  variant="tonal"
                  icon={dueNewQueue && playing ? 'pause' : 'play_arrow'}
                  iconFill
                  label={dueNewQueue && playing ? c.set.pauseDueNew : c.set.playDueNew(dueAndNew.length)}
                  onPress={onDueNew}
                />
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.list} accessibilityLabel={c.set.phrasesHeading}>
        {sorted.length === 0 ? (
          <Txt color="secondary" style={styles.empty}>
            {c.set.ownEmpty}
          </Txt>
        ) : (
          sorted.map(({ phrase, position, progress: p }, i) => {
            // The phrase playing, whichever queue it plays in (this set, a review, a list).
            const isCurrent = currentId === phrase.id;
            return (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                leading={String(position)}
                detail={progressLabel(c, p, now)}
                isCurrent={isCurrent}
                isPlaying={isCurrent && player.status === 'playing'}
                // As in the queue: the playing phrase's target stays hidden while you recall it.
                hideTarget={isCurrent && !isTargetRevealed(player)}
                onPlay={() => load('set', sortedIds, { startIndex: i })}
                onMore={() => nav.showDetails(phrase.id, mine ? { ownSetId: setId } : {})}
              />
            );
          })
        )}
        {/* Its songs (plan 107): in the same list, marked by their music note. */}
        {setSongs.songs.map((song, i) => {
          const album = setSongs.albums.find((a) => a.id === song.albumId);
          return album ? <SongRow key={song.id} song={song} album={album} leading={String(sorted.length + i + 1)} /> : null;
        })}
        {served && (
          <View style={styles.grow}>
            <Button variant="tonal" icon="music_note" label={c.music.makeSong} onPress={() => nav.makeSong({ setId })} />
          </View>
        )}
        {/* Your own set grows from here: pick phrases without leaving the page. */}
        {mine && (
          <View style={styles.grow}>
            <Button variant="tonal" icon="add" label={c.set.addPhrases} onPress={() => setPicking(true)} />
            <Button variant="tonal" icon="auto_awesome" label={c.make.fromSet} onPress={() => nav.makeSet({ setId })} />
          </View>
        )}
      </View>

      {served?.owner === 'other' && <MoreSetsByMaker key={setId} setId={setId} author={served.author} />}

      {mine && <PickPhrasesSheet setId={picking ? setId : null} onClose={() => setPicking(false)} />}

      <Sheet open={sortOpen} title={c.set.sortTitle} onClose={() => setSortOpen(false)}>
        <View accessibilityRole="radiogroup" accessibilityLabel={c.set.sortTitle}>
          {SORTS.map((s) => (
            <SheetOption
              key={s.id}
              icon={s.icon}
              label={c.set.sort[s.id]}
              selected={sort === s.id}
              onPress={() => {
                actions.setPrefs({ sortBySet: { ...state.prefs.sortBySet, [setId]: s.id } });
                setSortOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>

      <ReportSheet item={reporting ? { kind: 'set', id: setId } : null} onClose={() => setReporting(false)} />
      <RenameSheet item={renaming && served ? { kind: 'set', id: served.id, title: served.title, description: served.description } : null} onClose={() => setRenaming(false)} />
      <Sheet open={moreOpen} title={view.title} onClose={() => setMoreOpen(false)}>
        <SheetOption
          icon="queue_play_next"
          label={c.set.playNext}
          disabled={sortedIds.length === 0}
          onPress={() => {
            actions.enqueue(sortedIds, setId, 'next');
            toast(c.set.addedNext);
            setMoreOpen(false);
          }}
        />
        <SheetOption
          icon="queue_music"
          label={c.set.addToQueue}
          disabled={sortedIds.length === 0}
          onPress={() => {
            actions.enqueue(sortedIds, setId, 'end');
            toast(c.set.addedEnd);
            setMoreOpen(false);
          }}
        />
        {/* Your own set lives only on this device: its link would open "isn't available" for anyone else. */}
        {served?.owner === 'loro' && <SheetOption icon="share" label={c.set.share} onPress={() => void share()} />}
        {/* A set in someone's account (plan 106): its owner decides who sees it; others save it. */}
        {served && served.owner !== 'loro' && (served.owner === 'me' || served.shareCode) && (
          <SheetOption
            icon="share"
            label={served.owner === 'me' ? `${c.share.share} · ${c.share[served.visibility]}` : c.share.share}
            onPress={() => {
              setMoreOpen(false);
              nav.share({ kind: 'set', ...served });
            }}
          />
        )}
        {served?.owner === 'other' && (
          <SheetOption
            icon={served.saved ? 'bookmark_added' : 'bookmark_add'}
            label={served.saved ? c.share.unsave : c.share.save}
            onPress={() => {
              setMoreOpen(false);
              void toggleSaved();
            }}
          />
        )}
        {served?.owner === 'other' && (
          <SheetOption
            icon="info"
            label={c.share.report}
            onPress={() => {
              setMoreOpen(false);
              setReporting(true);
            }}
          />
        )}
        {served && (
          <SheetOption
            icon="music_note"
            label={c.music.makeSong}
            onPress={() => {
              setMoreOpen(false);
              nav.makeSong({ setId });
            }}
          />
        )}
        {served?.owner === 'me' && (
          <>
            <SheetOption
              icon="edit"
              label={c.createSet.editTitle}
              onPress={() => {
                setMoreOpen(false);
                setRenaming(true);
              }}
            />
            <SheetOption
              icon="auto_awesome"
              label={c.phrasesTab.makeSet}
              onPress={() => {
                setMoreOpen(false);
                nav.makeSet({ setId });
              }}
            />
            <SheetOption
              icon="palette"
              label={drawing ? c.share.coverMaking : c.share.cover}
              disabled={drawing}
              onPress={() => {
                setMoreOpen(false);
                void drawCover();
              }}
            />
            <SheetOption
              icon="delete"
              label={c.share.delete}
              tone="danger"
              onPress={() => {
                setMoreOpen(false);
                void removeServed();
              }}
            />
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  message: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 32 },
  otherCourse: { alignItems: 'flex-start', gap: 12 },
  head: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 },
  headText: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  kicker: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  level: { marginLeft: 4, paddingHorizontal: 6, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh },
  subtitle: { marginTop: 2 },
  summary: { marginTop: 12 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  iconButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  first: { marginLeft: -8 },
  pressed: { backgroundColor: colors.surfaceContainer },
  pausedAt: { flex: 1, minWidth: 72 },
  play: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  bigPlay: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...shadow.cover },
  disabled: { opacity: 0.4 },
  orderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, marginTop: 8 },
  order: { minHeight: TARGET, marginLeft: -8, paddingLeft: 8, paddingRight: 6, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 2 },
  list: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 24 },
  empty: { paddingHorizontal: 8, paddingVertical: 12 },
  grow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 8, marginTop: 8 },
});
