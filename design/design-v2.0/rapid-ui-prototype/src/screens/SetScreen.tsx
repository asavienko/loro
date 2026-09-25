import { useState } from 'react';
import { coursesFor, getTopic, Phrase } from '../content';
import { languageName } from '../copy';
import { goBack, routeUrl } from '../nav/history';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView } from '../state/catalog';
import { formatElapsed } from '../state/clock';
import {
  currentPhraseId,
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
import { SetCover } from '../ui/SetCover';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { btnIcon, btnPrimarySm, btnText, btnTonal } from '../ui/button';

const SORTS: { id: SortKey; icon: IconName }[] = [
  { id: 'set', icon: 'format_list_numbered' },
  { id: 'az', icon: 'sort_by_alpha' },
  { id: 'due', icon: 'schedule' },
  { id: 'weakest', icon: 'trending_down' },
];

const STATUS_RANK: Record<PhraseProgress['status'], number> = { due: 0, learning: 1, new: 2, learned: 3 };

export function SetScreen({ setId }: { setId: string }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const progress = setProgress(state.learner, view.phraseIds, now);
  const liked = isLiked(state.learner, 'set', setId);
  const currentId = currentPhraseId(state.player);
  const isThisSet = state.player.setId === setId;
  const playing = isThisSet && state.player.status === 'playing';
  const duration = setDurationMs(state, view);
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';

  const rows = view.phraseIds
    .map((id, i) => ({ phrase: findPhrase(state.learner, id), position: i + 1 }))
    .filter((r): r is { phrase: Phrase; position: number } => Boolean(r.phrase))
    .map((r) => ({ ...r, progress: phraseProgress(state.learner, r.phrase.id, now) }));
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

  const onPlay = () => {
    if (isThisSet && playing) actions.pause();
    else if (isThisSet && currentId) actions.play();
    else nav.playSet(setId, { phraseIds: sortedIds });
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

  return (
    <div className="max-w-3xl mx-auto">
      <section className="px-4 pt-4 pb-5 bg-surface-container-low border-b border-surface-container-high">
        <div className="flex flex-wrap gap-4 items-center">
          <SetCover set={view} size="md" className="w-32 h-32 rounded-2xl shadow-cover shrink-0" />
          <div className="min-w-0">
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
                    {view.level && <span className="ml-1 px-1.5 rounded-md bg-surface-container-high">{view.level}</span>}
                  </>
                )
              )}
            </p>
            <h1 lang={view.targetLang} className="font-serif text-display font-semibold leading-tight [overflow-wrap:anywhere]">{view.title}</h1>
            {view.content && <p className="text-body text-secondary">{view.content.subtitle[locale]}</p>}
          </div>
        </div>
        <p className="text-body text-secondary mt-4">
          {c.set.summary(progress.total, progress.learned, progress.due)}
          {duration !== null && ` · ${c.set.duration(formatElapsed(duration))}`}
        </p>
        <div className="flex flex-wrap items-center gap-1 mt-2">
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
          <span className="flex-1" />
          <button
            type="button"
            aria-label={c.set.shufflePlay}
            onClick={() => nav.playSet(setId, { phraseIds: sortedIds, shuffle: true })}
            className={`${btnIcon} text-secondary`}
          >
            <Icon name="shuffle" className="text-icon-lg" />
          </button>
          <button
            type="button"
            aria-label={playing ? c.set.pauseAll(view.title) : c.set.playAll(view.title)}
            onClick={onPlay}
            disabled={sortedIds.length === 0}
            className="w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-cover active:scale-95 transition-transform disabled:opacity-40"
          >
            <Icon name={playing ? 'pause' : 'play_arrow'} fill className="text-icon-2xl" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <p className="text-label text-secondary">{c.set.playsIn(c.set.sort[sort])}</p>
          {dueAndNew.length > 0 && dueAndNew.length < sortedIds.length && (
            <button
              type="button"
              onClick={() => nav.playSet(setId, { phraseIds: dueAndNew })}
              className={btnTonal}
            >
              <Icon name="play_arrow" fill className="text-icon-md" />
              {c.set.playDueNew(dueAndNew.length)}
            </button>
          )}
        </div>
      </section>

      <section className="px-2 pt-3" aria-labelledby="phrases-heading">
        <div className="flex items-center justify-between px-2 mb-1">
          <h2 id="phrases-heading" className="font-serif text-heading font-semibold">{c.set.phrasesHeading}</h2>
          <button type="button" onClick={() => setSortOpen(true)} className={`${btnText} -mr-2`}>
            <Icon name="sort" className="text-icon-sm" />
            {c.set.sort[sort]}
          </button>
        </div>
        {sorted.length === 0 ? (
          <div className="px-2 py-3 flex flex-col items-start gap-2">
            <p className="text-body text-secondary">{c.set.ownEmpty}</p>
            <button
              type="button"
              onClick={() => nav.go({ name: 'explore' })}
              className={btnPrimarySm}
            >
              <Icon name="search" className="text-icon-md" />
              {c.set.findPhrases}
            </button>
          </div>
        ) : (
          <ul>
            {sorted.map(({ phrase, position, progress: p }, i) => {
              const isCurrent = isThisSet && currentId === phrase.id;
              return (
                <li key={phrase.id}>
                  <PhraseRow
                    phrase={phrase}
                    leading={String(position)}
                    detail={progressLabel(c, p, now)}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && playing}
                    // As in the queue: the playing phrase's Spanish stays hidden while you recall it.
                    hideTarget={isCurrent && !isTargetRevealed(state.player)}
                    onPlay={() => nav.playSet(setId, { phraseIds: sortedIds, startIndex: i })}
                    onMore={() => nav.showDetails(phrase.id, view.kind === 'own' ? { ownSetId: setId } : {})}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
