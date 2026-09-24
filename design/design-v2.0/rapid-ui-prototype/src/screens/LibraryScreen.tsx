import { useState } from 'react';
import { findPhrase, getSet, PHRASES } from '../content';
import type { Navigation } from '../App';
import { PhraseRow } from '../components/PhraseRow';
import { SetCover } from '../components/SetCover';
import { progressLabel } from '../lib/progressLabel';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { LEARNED_STABILITY_DAYS } from '../state/memory';
import { learnedPhraseIds, learnerStats, phraseProgress, setProgress } from '../state/selectors';
import { useNow, useStore } from '../state/store';

type Filter = 'saved' | 'learned' | 'sets';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'saved', label: 'Saved phrases' },
  { id: 'learned', label: 'Learned' },
  { id: 'sets', label: 'My sets' },
];
const FILTER_IDS = FILTERS.map((f) => f.id);
const TABS = 'library';

export function LibraryScreen({ nav }: { nav: Navigation }) {
  const { state } = useStore();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>('saved');
  const stats = learnerStats(state.learner, now);
  const { learner } = state;

  const savedIds = learner.savedPhraseIds.filter((id) => findPhrase(id));
  const learnedIds = learnedPhraseIds(learner, PHRASES.map((p) => p.id));

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-2">
        <StatCard label="Learned" value={`${stats.learned}/${PHRASES.length}`} note={`Recall lasts ${LEARNED_STABILITY_DAYS}+ days`} />
        <StatCard
          label="Recall now"
          value={stats.averageRetention === null ? '—' : `${stats.averageRetention}%`}
          note={stats.averageRetention === null ? 'Rate a phrase first' : 'Average, rated phrases'}
        />
        <StatCard label="Started" value={String(stats.started)} note="Phrases heard at least once" />
      </dl>

      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Library"
        onKeyDown={tabListKeyDown(TABS, FILTER_IDS, filter, setFilter)}
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            id={tabId(TABS, f.id)}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            aria-controls={panelId(TABS, f.id)}
            tabIndex={filter === f.id ? 0 : -1}
            onClick={() => setFilter(f.id)}
            className={`min-h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap border ${
              filter === f.id
                ? 'bg-primary-container text-on-primary border-primary-container'
                : 'bg-surface-container-low text-on-surface border-outline-variant/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={panelId(TABS, filter)} aria-labelledby={tabId(TABS, filter)}>
        {filter === 'saved' || filter === 'learned' ? (
          <PhraseList
            ids={filter === 'saved' ? savedIds : learnedIds}
            empty={
              filter === 'saved'
                ? 'Tap the heart in the player to save a phrase here.'
                : `A phrase is learned once your recall of it is expected to last ${LEARNED_STABILITY_DAYS} days or more.`
            }
            now={now}
            nav={nav}
          />
        ) : learner.likedSetIds.length === 0 ? (
          <p className="text-sm text-secondary py-2">Tap the heart on a set to add it here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {learner.likedSetIds.map((id) => {
              const set = getSet(id);
              const progress = setProgress(learner, id, now);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => nav.openSet(id)}
                    className="w-full min-h-16 flex items-center gap-3 p-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-left active:bg-surface-container-low"
                  >
                    <SetCover set={set} size="sm" className="w-14 h-14 rounded-xl shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-serif text-base font-bold truncate">{set.title}</span>
                      <span className="block text-xs text-secondary">
                        {progress.total} phrases · {progress.learned} learned
                      </span>
                    </span>
                    <span aria-hidden="true" className="material-symbols-outlined text-secondary">chevron_right</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 flex flex-col">
      <dt className="text-xs font-semibold text-secondary">{label}</dt>
      <dd className="font-serif text-2xl font-bold mt-0.5 tabular-nums">{value}</dd>
      <dd className="text-[11px] leading-snug text-on-surface-variant mt-0.5">{note}</dd>
    </div>
  );
}

function PhraseList({ ids, empty, now, nav }: { ids: string[]; empty: string; now: number; nav: Navigation }) {
  const { state } = useStore();
  if (ids.length === 0) return <p className="text-sm text-secondary py-2">{empty}</p>;
  return (
    <ul className="-mx-2">
      {ids.map((id, i) => (
        <li key={id}>
          <PhraseRow
            phrase={findPhrase(id)!}
            detail={progressLabel(phraseProgress(state.learner, id, now), now)}
            onPlay={() => nav.playList(ids, i)}
            onMore={() => nav.showDetails(id)}
          />
        </li>
      ))}
    </ul>
  );
}
