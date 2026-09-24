import { useState } from 'react';
import { PHRASES, SETS, TOPICS } from '../content';
import type { Navigation } from '../App';
import { PhraseRow } from '../components/PhraseRow';
import { SetCover, TONE } from '../components/SetCover';
import { progressLabel } from '../lib/progressLabel';
import { phraseProgress, setProgress } from '../state/selectors';
import { useNow, useStore } from '../state/store';

/** Case- and accent-insensitive text for search. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ExploreScreen({ nav }: { nav: Navigation }) {
  const { state } = useStore();
  const now = useNow(30_000);
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);

  const q = fold(query.trim());
  const sets = SETS.filter(
    (s) =>
      (!topicId || s.topicId === topicId) &&
      (!q || fold(`${s.title} ${s.subtitle}`).includes(q)),
  );
  const phrases = q
    ? PHRASES.filter(
        (p) =>
          (!topicId || SETS.find((s) => s.id === p.setId)?.topicId === topicId) &&
          fold(`${p.target.text} ${p.native.text}`).includes(q),
      )
    : [];
  const topic = TOPICS.find((t) => t.id === topicId);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-6">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true">
          search
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phrases and sets"
          aria-label="Search phrases and sets"
          className="w-full min-h-12 pl-11 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-container"
        />
      </div>

      <section aria-labelledby="topics-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="topics-heading" className="font-serif text-xl font-semibold">Topics</h2>
          {topic && (
            <button
              type="button"
              onClick={() => setTopicId(null)}
              className="min-h-11 px-3 -mr-2 rounded-full text-sm font-semibold text-primary-container active:bg-surface-container"
            >
              Show all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TOPICS.map((t, i) => {
            const selected = t.id === topicId;
            const setCount = SETS.filter((s) => s.topicId === t.id).length;
            // An odd last tile spans the row instead of leaving a gap beside it.
            const spansRow = i === TOPICS.length - 1 && TOPICS.length % 2 === 1;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTopicId(selected ? null : t.id)}
                className={`relative min-h-20 rounded-2xl p-3 text-left flex flex-col justify-between overflow-hidden ${TONE[t.tone]} ${
                  spansRow ? 'col-span-2' : ''
                } ${selected ? 'ring-2 ring-primary-container ring-offset-2 ring-offset-surface' : ''}`}
              >
                <span>
                  <span className="block text-[15px] font-bold">{t.title}</span>
                  <span className="block text-xs opacity-80">
                    {setCount} {setCount === 1 ? 'set' : 'sets'}
                  </span>
                </span>
                <span className="material-symbols-outlined text-[32px] self-end opacity-80" aria-hidden="true">
                  {t.icon}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {q && (
        <section aria-labelledby="phrase-results">
          <h2 id="phrase-results" className="font-serif text-xl font-semibold mb-1">
            Phrases · {phrases.length}
          </h2>
          {phrases.length === 0 ? (
            <p className="text-sm text-secondary py-2">No phrases match “{query.trim()}”.</p>
          ) : (
            <ul className="-mx-2">
              {phrases.map((p) => (
                <li key={p.id}>
                  <PhraseRow
                    phrase={p}
                    detail={progressLabel(phraseProgress(state.learner, p.id, now), now)}
                    onPlay={() => nav.playPhraseInSet(p.id)}
                    onMore={() => nav.showDetails(p.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="set-results">
        <h2 id="set-results" className="font-serif text-xl font-semibold mb-2">
          {topic ? `${topic.title} sets` : q ? `Sets · ${sets.length}` : 'All sets'}
        </h2>
        {sets.length === 0 ? (
          <p className="text-sm text-secondary py-2">No sets match.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {sets.map((set) => {
              const progress = setProgress(state.learner, set.id, now);
              return (
                <li key={set.id}>
                  <button type="button" onClick={() => nav.openSet(set.id)} className="w-full text-left">
                    <SetCover set={set} size="md" className="w-full aspect-square rounded-2xl" />
                    <span className="block text-sm font-bold mt-2 truncate">{set.title}</span>
                    <span className="block text-xs text-secondary">
                      {progress.total} phrases · {progress.learned} learned
                    </span>
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
