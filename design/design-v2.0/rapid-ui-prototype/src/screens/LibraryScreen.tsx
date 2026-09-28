import { useRef, useState } from 'react';
import { navigate } from '../nav/history';
import { useNav } from '../nav/NavContext';
import type { LibraryView } from '../nav/routes';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { useSelectedInView } from '../lib/useSelectedInView';
import { findPhrase, findSetView, ownPhrases, ownSets, SetView } from '../state/catalog';
import { LEARNED_MIN_SUCCESSES, LEARNED_STABILITY_DAYS } from '../state/memory';
import {
  displayLearner,
  duePhraseIds,
  learningIds,
  learnedIds,
  learnedPerWeek,
  learnerStats,
  likedPhraseIds,
  likedSetIds,
  phraseProgress,
  recallBuckets,
  recentlyMissedIds,
  setProgress,
} from '../state/selectors';
import { coursePhrases } from '../state/catalog';
import { useCopy, useNow, useStore } from '../state/store';
import type { LibraryListView } from '../state/types';
import { RecallChart, WeeklyChart } from '../ui/Charts';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetRow } from '../ui/SetRow';
import { StatTile } from '../ui/StatTile';
import { btnPrimarySm, btnTonal } from '../ui/button';

const PHRASE_VIEWS: LibraryView[] = ['liked', 'mine', 'due', 'learning', 'missed', 'learned'];
const SET_VIEWS: LibraryView[] = ['ownSets', 'likedSets'];
const TABS = 'library';

export function LibraryScreen({ view: chosen }: { view?: LibraryView }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const now = useNow(30_000);
  // Ratings still in their undo window count in every list and figure here.
  const learner = displayLearner(state);
  const stats = learnerStats(learner, now);
  // Opened without a view: what's useful now (reviews due, then liked, then what you've
  // started), not an empty Liked for someone who has liked nothing.
  // Chosen once, when the page opens: it doesn't switch under the learner as phrases fall due.
  const [firstPhraseView] = useState<LibraryView>(() =>
    duePhraseIds(learner, now).length > 0
      ? 'due'
      : likedPhraseIds(learner).length > 0
        ? 'liked'
        : learningIds(learner, now).length > 0
          ? 'learning'
          : 'liked',
  );
  const view = chosen ?? firstPhraseView;
  const segment = SET_VIEWS.includes(view) ? 'sets' : 'phrases';
  const views = segment === 'sets' ? SET_VIEWS : PHRASE_VIEWS;
  const go = (next: LibraryView) => navigate({ name: 'library', view: next }, { replace: true });
  const chipRow = useRef<HTMLDivElement>(null);
  useSelectedInView(chipRow, view);

  const phraseIds: Record<string, () => string[]> = {
    liked: () => likedPhraseIds(learner),
    mine: () => ownPhrases(learner).map((p) => p.id),
    due: () => duePhraseIds(learner, now),
    learning: () => learningIds(learner, now),
    missed: () => recentlyMissedIds(learner, now),
    learned: () => learnedIds(learner, coursePhrases(learner).map((p) => p.id)),
  };

  // A figure in Progress opens its list; the list is at the top of the page (or beside it on a
  // wide screen), so the page goes back up to show it.
  const openList = (next: LibraryView) => {
    go(next);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  };

  return (
    // The list comes first, like a music library; the figures follow under Progress. On a wide
    // screen they sit in a column beside the list and stay in view while it scrolls.
    <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 pt-4 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 lg:items-start">
      <div className="min-w-0 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container-low rounded-full" role="group">
          {(['phrases', 'sets'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={segment === s}
              // The segment already shown keeps its view (Missed stays Missed).
              onClick={() => segment !== s && go(s === 'sets' ? 'ownSets' : firstPhraseView)}
              className={`min-h-11 rounded-full text-body ${segment === s ? 'bg-surface-container-lowest font-bold shadow-card' : 'text-secondary font-medium'}`}
            >
              {s === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
            </button>
          ))}
        </div>

        {/* One line of filters that scrolls, never two or three lines of wrapped chips. */}
        <div
          ref={chipRow}
          className="scroll-row flex gap-x-2 overflow-x-auto -mx-4 px-4 -mt-1"
          role="tablist"
          aria-label={segment === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
        >
          {views.map((v) => (
            <Chip
              key={v}
              id={tabId(TABS, v)}
              role="tab"
              selected={view === v}
              aria-controls={panelId(TABS, v)}
              tabIndex={view === v ? 0 : -1}
              onKeyDown={tabListKeyDown(TABS, views, view, go)}
              onClick={() => go(v)}
            >
              {c.library.filters[v]}
            </Chip>
          ))}
        </div>

        <section role="tabpanel" id={panelId(TABS, view)} aria-labelledby={tabId(TABS, view)}>
          {segment === 'phrases' ? (
            <PhraseList ids={phraseIds[view]()} view={view} now={now} />
          ) : (
            <SetList ids={view === 'ownSets' ? ownSets(learner).map((s) => s.id) : likedSetIds(learner)} view={view} now={now} />
          )}
          {view === 'mine' && (
            <button type="button" onClick={() => nav.addPhrase()} className={`${btnTonal} mt-3`}>
              <Icon name="add" className="text-icon-md" />
              {c.library.addPhrase}
            </button>
          )}
          {view === 'ownSets' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={() => nav.createSet()} className={btnTonal}>
                <Icon name="add" className="text-icon-md" />
                {c.library.newSet}
              </button>
              <button type="button" onClick={() => nav.makeSet()} className={btnTonal}>
                <Icon name="auto_awesome" className="text-icon-md" />
                {c.make.title}
              </button>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="progress-heading" className="flex flex-col gap-3 lg:sticky lg:top-[calc(4.5rem+env(safe-area-inset-top))]">
        <h2 id="progress-heading" className="font-serif text-heading font-semibold">{c.library.progress}</h2>
        {/* Value beside its words, so a narrow tile never hyphenates its note into three lines. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
          <StatTile layout="horizontal" label={c.library.learned} value={String(stats.learned)} note={c.library.learnedNote(LEARNED_STABILITY_DAYS, LEARNED_MIN_SUCCESSES)} onClick={() => openList('learned')} />
          <StatTile
            layout="horizontal"
            label={c.library.recall}
            value={stats.averageRecall === null ? '—' : `${stats.averageRecall}%`}
            note={stats.averageRecall === null ? c.library.recallNone : c.library.recallNote(stats.rated)}
            onClick={() => openList('learning')}
          />
          <StatTile layout="horizontal" label={c.library.started} value={String(stats.started)} note={c.library.startedNote} onClick={() => openList('learning')} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1">
          <RecallChart buckets={recallBuckets(learner, now)} />
          <WeeklyChart weeks={learnedPerWeek(learner, now)} />
        </div>
      </section>
    </div>
  );
}

function PhraseList({ ids, view, now }: { ids: string[]; view: LibraryView; now: number }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const empty = view === 'learned' ? c.library.empty.learned(LEARNED_STABILITY_DAYS, LEARNED_MIN_SUCCESSES) : c.library.empty[view as Exclude<LibraryView, 'learned' | 'ownSets' | 'likedSets'>];
  if (ids.length === 0) return <p className="text-body text-secondary py-2">{empty}</p>;
  return (
    <>
      {/* The list's header: how many, and the one filled button on the page. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3">
        <p className="min-h-11 flex items-center text-label font-semibold text-secondary">{c.common.phrases(ids.length)}</p>
        <button type="button" onClick={() => nav.playList(ids, 0, { kind: 'library', view: view as LibraryListView })} className={`${btnPrimarySm} mb-2`}>
          <Icon name="play_arrow" fill className="text-icon-md" />
          {c.library.playAll(ids.length)}
        </button>
      </div>
      <ul className="-mx-2">
        {ids.map((id, i) => {
          const phrase = findPhrase(state.learner, id);
          if (!phrase) return null;
          return (
            // Named for the phrase, so "Add your phrase" can bring a new one into view.
            <li key={id} data-phrase-row={id}>
              <PhraseRow
                phrase={phrase}
                detail={progressLabel(c, phraseProgress(displayLearner(state), id, now), now)}
                onPlay={() => nav.playList(ids, i, { kind: 'library', view: view as LibraryListView })}
                onMore={() => nav.showDetails(id)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SetList({ ids, view, now }: { ids: string[]; view: LibraryView; now: number }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const views = ids.map((id) => findSetView(state.learner, id)).filter((v): v is SetView => Boolean(v));
  if (views.length === 0) return <p className="text-body text-secondary py-2">{c.library.empty[view as 'ownSets' | 'likedSets']}</p>;
  return (
    <>
    <p className="text-label font-semibold text-secondary min-h-11 flex items-center">{c.common.sets(views.length)}</p>
    <ul>
      {views.map((v) => {
        const progress = setProgress(displayLearner(state), v.phraseIds, now);
        return (
          <li key={v.id}>
            <SetRow set={v} meta={c.set.summary(progress.total, progress.learned, progress.due)} onOpen={() => nav.openSet(v.id)} />
          </li>
        );
      })}
    </ul>
    </>
  );
}
