import { useState } from 'react';
import { navigate } from '../nav/history';
import { useNav } from '../nav/NavContext';
import type { LibraryView } from '../nav/routes';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { findPhrase, findSetView, ownPhrases, ownSets, SetView } from '../state/catalog';
import { LEARNED_MIN_SUCCESSES, LEARNED_STABILITY_DAYS } from '../state/memory';
import {
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
import { RecallChart, WeeklyChart } from '../ui/Charts';
import { Icon } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetCover } from '../ui/SetCover';

const PHRASE_VIEWS: LibraryView[] = ['liked', 'mine', 'due', 'learning', 'missed', 'learned'];
const SET_VIEWS: LibraryView[] = ['ownSets', 'likedSets'];
const TABS = 'library';

export function LibraryScreen({ view: chosen }: { view?: LibraryView }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const now = useNow(30_000);
  const { learner } = state;
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

  const phraseIds: Record<string, () => string[]> = {
    liked: () => likedPhraseIds(learner),
    mine: () => ownPhrases(learner).map((p) => p.id),
    due: () => duePhraseIds(learner, now),
    learning: () => learningIds(learner, now),
    missed: () => recentlyMissedIds(learner, now),
    learned: () => learnedIds(learner, coursePhrases(learner).map((p) => p.id)),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={c.library.learned} value={String(stats.learned)} note={c.library.learnedNote(LEARNED_STABILITY_DAYS, LEARNED_MIN_SUCCESSES)} onClick={() => go('learned')} />
        <StatCard
          label={c.library.recall}
          value={stats.averageRecall === null ? '—' : `${stats.averageRecall}%`}
          note={stats.averageRecall === null ? c.library.recallNone : c.library.recallNote(stats.rated)}
          onClick={() => go('learning')}
        />
        <StatCard label={c.library.started} value={String(stats.started)} note={c.library.startedNote} onClick={() => go('learning')} />
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container-low rounded-full" role="group">
        {(['phrases', 'sets'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={segment === s}
            // The segment already shown keeps its view (Missed stays Missed).
            onClick={() => segment !== s && go(s === 'sets' ? 'ownSets' : firstPhraseView)}
            className={`min-h-11 rounded-full text-body ${segment === s ? 'bg-surface-container-lowest font-bold shadow-sm' : 'text-secondary font-medium'}`}
          >
            {s === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
          </button>
        ))}
      </div>

      <div
        className="flex flex-wrap gap-2 -mt-2"
        role="tablist"
        aria-label={segment === 'sets' ? c.library.setsSegment : c.library.phrasesSegment}
      >
        {views.map((v) => (
          <button
            key={v}
            id={tabId(TABS, v)}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-controls={panelId(TABS, v)}
            tabIndex={view === v ? 0 : -1}
            onKeyDown={tabListKeyDown(TABS, views, view, go)}
            onClick={() => go(v)}
            className={`min-h-11 px-4 rounded-full text-body font-semibold whitespace-nowrap border ${
              view === v ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface-container-low text-on-surface border-outline-variant/50'
            }`}
          >
            {c.library.filters[v]}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={panelId(TABS, view)} aria-labelledby={tabId(TABS, view)}>
        {segment === 'phrases' ? (
          <PhraseList ids={phraseIds[view]()} view={view} now={now} />
        ) : (
          <SetList ids={view === 'ownSets' ? ownSets(learner).map((s) => s.id) : likedSetIds(learner)} view={view} now={now} />
        )}
        {view === 'mine' && (
          <button type="button" onClick={() => nav.addPhrase()} className="mt-3 min-h-11 px-4 rounded-full bg-surface-container text-on-surface text-body font-semibold flex items-center gap-1.5">
            <Icon name="add" className="text-icon-md" />
            {c.library.addPhrase}
          </button>
        )}
        {view === 'ownSets' && (
          <button type="button" onClick={() => nav.createSet()} className="mt-3 min-h-11 px-4 rounded-full bg-surface-container text-on-surface text-body font-semibold flex items-center gap-1.5">
            <Icon name="add" className="text-icon-md" />
            {c.library.newSet}
          </button>
        )}
      </section>

      <section aria-label={c.library.progress} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <RecallChart buckets={recallBuckets(learner, now)} />
        <WeeklyChart weeks={learnedPerWeek(learner, now)} />
      </section>
    </div>
  );
}

function StatCard({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 flex flex-col text-left active:bg-surface-container-low">
      <span className="text-label font-semibold text-secondary break-words hyphens-auto">{label}</span>
      <span className="font-serif text-display-sm font-bold mt-0.5 tabular-nums">{value}</span>
      <span className="text-caption leading-snug text-on-surface-variant mt-0.5 break-words hyphens-auto">{note}</span>
    </button>
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
      <button type="button" onClick={() => nav.playList(ids)} className="mb-2 min-h-11 px-4 rounded-full bg-primary-container text-on-primary text-body font-bold flex items-center gap-1.5">
        <Icon name="play_arrow" fill className="text-icon-md" />
        {c.library.playAll(ids.length)}
      </button>
      <ul className="-mx-2">
        {ids.map((id, i) => {
          const phrase = findPhrase(state.learner, id);
          if (!phrase) return null;
          return (
            <li key={id}>
              <PhraseRow
                phrase={phrase}
                detail={progressLabel(c, phraseProgress(state.learner, id, now), now)}
                onPlay={() => nav.playList(ids, i)}
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
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {views.map((v) => {
        const progress = setProgress(state.learner, v.phraseIds, now);
        return (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => nav.openSet(v.id)}
              className="w-full min-h-16 flex items-center gap-3 p-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-left active:bg-surface-container-low"
            >
              <SetCover set={v} size="sm" className="w-14 h-14 rounded-xl shrink-0" />
              <span className="flex-1 min-w-0">
                <span lang={v.targetLang} className="block font-serif text-base font-bold truncate">{v.title}</span>
                <span className="block text-label text-secondary">{c.set.summary(progress.total, progress.learned, progress.due)}</span>
              </span>
              <Icon name="chevron_right" className="text-icon text-secondary" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
