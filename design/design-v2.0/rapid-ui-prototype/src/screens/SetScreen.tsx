import { useState } from 'react';
import { coursesFor, getTopic, Phrase } from '../content';
import { languageName } from '../copy';
import { goBack, routeUrl } from '../nav/history';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView } from '../state/catalog';
import { formatElapsed } from '../state/clock';
import {
  currentPhraseId,
  displayLearner,
  isLiked,
  phraseProgress,
  PhraseProgress,
  setDurationMs,
  setProgress,
  sortFor,
} from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import type { SortKey } from '../state/types';
import { Icon, IconName } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { isTargetRevealed } from '../ui/phase';
import { progressLabel } from '../ui/progressLabel';
import { SetCover, TONE_WASH } from '../ui/SetCover';
import { PickPhrasesSheet } from '../sheets/PickPhrasesSheet';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { btnIcon, btnPrimarySm, btnTonal } from '../ui/button';

const SORTS: { id: SortKey; icon: IconName }[] = [
  { id: 'set', icon: 'format_list_numbered' },
  { id: 'az', icon: 'sort_by_alpha' },
  { id: 'due', icon: 'schedule' },
  { id: 'weakest', icon: 'trending_down' },
];

const STATUS_RANK: Record<PhraseProgress['status'], number> = { due: 0, learning: 1, new: 2, learned: 3 };

/**
 * What a set page last put in the queue, per set: the whole set or its due-and-new phrases, and in
 * which sort. The big Play resumes only a queue that is this whole set in the order shown; the
 * sorts by status reorder themselves as phrases are rated, so the order is compared with the one
 * the page loaded, in the sort it was loaded in. After a reload, the order shown is compared.
 */
const loadedHere = new Map<string, { kind: 'set' | 'dueNew'; ids: string[]; sort: SortKey }>();
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export function SetScreen({ setId }: { setId: string }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const view = findSetView(state.learner, setId);
  if (!view) return <p className="max-w-3xl mx-auto px-4 pt-8 text-body text-secondary">{c.set.notFound}</p>;
  // A link or a history entry can lead to another course's set: say so rather than play it
  // into this course's progress, and offer the switch when that course is open to the learner.
  const { profile } = state.learner;
  if (view.targetLang !== profile.targetLang) {
    const language = languageName(view.targetLang, c.locale);
    return (
      <div className="max-w-3xl mx-auto px-4 pt-8 flex flex-col items-start gap-3">
        <p className="text-body text-secondary">{c.set.otherCourse(language)}</p>
        {coursesFor(profile.nativeLang).includes(view.targetLang) && (
          <button
            type="button"
            onClick={() => actions.setProfile({ targetLang: view.targetLang })}
            className={btnPrimarySm}
          >
            {c.set.switchCourse(language)}
          </button>
        )}
      </div>
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

  const share = async () => {
    const url = routeUrl({ name: 'set', id: setId, from: 'explore' });
    try {
      if (navigator.share) await navigator.share({ title: view.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(c.set.linkCopied);
      }
    } catch (error) {
      // The learner cancelled the share sheet; anything else means copying failed.
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast(c.set.copyUnavailable);
    }
  };

  const tone = (view.topicId && topic?.tone) || 'secondary';

  return (
    <div>
      {/* The page takes its cover's colour, edge to edge, fading into the paper. */}
      <div className={`bg-linear-to-b ${TONE_WASH[tone]} to-surface`}>
        <section className="@container max-w-3xl mx-auto px-4 pt-4 pb-1">
          {/* Cover and title side by side, whatever the title's length, so sibling sets share one
              layout; only very large text (a column under 16rem) puts the title under the cover. */}
          <div className="flex items-start gap-4 @max-[16rem]:flex-col @max-[16rem]:gap-3">
            <SetCover set={view} size="md" className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl shadow-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-label font-semibold text-secondary flex flex-wrap items-center gap-1">
                {view.kind === 'own' ? (
                  <>
                    <Icon name="edit_note" className="text-icon-xs" />
                    {c.set.own}
                  </>
                ) : (
                  topic && (
                    <>
                      <Icon name={topic.icon as IconName} className="text-icon-xs" />
                      {topic.title[locale]}
                      {view.level && <span className="ml-1 px-1.5 rounded-lg bg-surface-container-high">{view.level}</span>}
                    </>
                  )
                )}
              </p>
              <h1 lang={view.targetLang} className="font-serif text-display-sm sm:text-display font-semibold leading-tight [overflow-wrap:anywhere]">
                {view.title}
              </h1>
              {view.content && <p className="text-body text-secondary mt-0.5">{view.content.subtitle[locale]}</p>}
            </div>
          </div>
          <p className="text-body text-secondary mt-3">
            {c.set.summary(progress.total, progress.learned, progress.due)}
            {/* The duration moves to the next line whole rather than leaving "1×" alone there. */}
            {duration !== null && sortedIds.length > 0 && (
              <>
                {' · '}
                <span className="inline-block">{c.set.duration(formatElapsed(duration))}</span>
              </>
            )}
          </p>
          {/* Like and More on the left; Play (and shuffle) on the right, and on a line of their own
              when large text leaves no room for both. */}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <button
              type="button"
              aria-label={c.set.like}
              aria-pressed={liked}
              onClick={() => actions.toggleLike('set', setId)}
              className={`${btnIcon} -ml-2 text-primary-container`}
            >
              <Icon name="favorite" fill={liked} className="text-icon-lg" />
            </button>
            <button type="button" aria-label={c.common.moreOptions} onClick={() => setMoreOpen(true)} className={`${btnIcon} text-secondary`}>
              <Icon name="more_horiz" className="text-icon-lg" />
            </button>
            {/* Where Play picks up, said beside it. */}
            {resumes && <p className="flex-1 min-w-[4.5rem] text-right text-label font-semibold text-secondary">{c.set.pausedAt(player.index + 1, player.order.length)}</p>}
            <span className="ml-auto flex items-center gap-1">
              {sortedIds.length > 1 && (
                <button
                  type="button"
                  aria-label={c.set.shufflePlay}
                  onClick={() => load('set', sortedIds, { shuffle: true })}
                  className={`${btnIcon} text-secondary`}
                >
                  <Icon name="shuffle" className="text-icon-lg" />
                </button>
              )}
              <button
                type="button"
                aria-label={bigPauses ? c.set.pauseAll(view.title) : resumes ? c.set.resume(view.title) : c.set.playAll(view.title)}
                onClick={onPlay}
                disabled={sortedIds.length === 0}
                className="w-14 h-14 shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-cover active:scale-95 transition-transform disabled:opacity-40"
              >
                <Icon name={bigPauses ? 'pause' : 'play_arrow'} fill className="text-icon-2xl" />
              </button>
            </span>
          </div>
          {/* The play order and the sort are one control: it says the order, and changes it. An
              empty set of your own has nothing to order yet. Where "Play due and new" fits beside it,
              it sits right under the big Play, so the row keeps clear of it; on a small phone it
              wraps under "Plays in", on the left, and the first phrase keeps its place on screen. */}
          {sortedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-2 @min-[22rem]:mt-2">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSortOpen(true)}
                className="min-h-11 -ml-2 pl-2 pr-1.5 rounded-full inline-flex items-center gap-0.5 text-left text-label font-semibold text-secondary active:bg-surface-container"
              >
                <span>{c.set.playsIn(c.set.sort[sort])}</span>
                <Icon name="keyboard_arrow_down" className="text-icon-sm shrink-0" />
              </button>
              {showDueNew && (
                <button type="button" onClick={onDueNew} className={btnTonal}>
                  <Icon name={dueNewQueue && playing ? 'pause' : 'play_arrow'} fill className="text-icon-md" />
                  {dueNewQueue && playing ? c.set.pauseDueNew : c.set.playDueNew(dueAndNew.length)}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="max-w-3xl mx-auto px-2 pt-1" aria-labelledby="phrases-heading">
        <h2 id="phrases-heading" className="sr-only">{c.set.phrasesHeading}</h2>
        {sorted.length === 0 ? (
          <p className="px-2 py-3 text-body text-secondary">{c.set.ownEmpty}</p>
        ) : (
          <ul>
            {sorted.map(({ phrase, position, progress: p }, i) => {
              // The phrase playing, whichever queue it plays in (this set, a review, a list).
              const isCurrent = currentId === phrase.id;
              return (
                <li key={phrase.id}>
                  <PhraseRow
                    phrase={phrase}
                    leading={String(position)}
                    detail={progressLabel(c, p, now)}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && player.status === 'playing'}
                    // As in the queue: the playing phrase's Spanish stays hidden while you recall it.
                    hideTarget={isCurrent && !isTargetRevealed(player)}
                    onPlay={() => load('set', sortedIds, { startIndex: i })}
                    onMore={() => nav.showDetails(phrase.id, view.kind === 'own' ? { ownSetId: setId } : {})}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {/* Your own set grows from here: pick phrases without leaving the page. */}
        {view.kind === 'own' && (
          <button type="button" onClick={() => setPicking(true)} className={`${btnTonal} mx-2 mt-2`}>
            <Icon name="add" className="text-icon-md" />
            {c.set.addPhrases}
          </button>
        )}
      </section>

      {view.kind === 'own' && <PickPhrasesSheet setId={picking ? setId : null} onClose={() => setPicking(false)} />}

      <Sheet open={sortOpen} title={c.set.sortTitle} onClose={() => setSortOpen(false)}>
        <div role="radiogroup" aria-label={c.set.sortTitle}>
          {SORTS.map((s) => (
            <SheetOption
              key={s.id}
              icon={s.icon}
              label={c.set.sort[s.id]}
              selected={sort === s.id}
              onClick={() => {
                actions.setPrefs({ sortBySet: { ...state.prefs.sortBySet, [setId]: s.id } });
                setSortOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={moreOpen} title={view.title} onClose={() => setMoreOpen(false)}>
        <SheetOption
          icon="queue_play_next"
          label={c.set.playNext}
          onClick={() => {
            actions.enqueue(sortedIds, setId, 'next');
            toast(c.set.addedNext);
            setMoreOpen(false);
          }}
        />
        <SheetOption
          icon="queue_music"
          label={c.set.addToQueue}
          onClick={() => {
            actions.enqueue(sortedIds, setId, 'end');
            toast(c.set.addedEnd);
            setMoreOpen(false);
          }}
        />
        {/* Your own set lives only on this device: its link would open "isn't available" for anyone else. */}
        {view.kind === 'content' && <SheetOption icon="share" label={c.set.share} onClick={() => void share()} />}
        {view.kind === 'own' && (
          <>
            <SheetOption
              icon="edit"
              label={c.set.rename}
              onClick={() => {
                setMoreOpen(false);
                nav.createSet([], setId);
              }}
            />
            <SheetOption
              icon="delete"
              label={c.set.delete}
              tone="danger"
              onClick={() => {
                actions.deleteSet(setId);
                setMoreOpen(false);
                toast(c.set.deleted, { action: { label: c.common.undo, run: () => actions.restoreSet(setId) } });
                // Back out of the deleted set's page, so Back later can't return to it.
                goBack({ name: 'library', view: 'ownSets' });
              }}
            />
          </>
        )}
      </Sheet>
    </div>
  );
}
