import { useState } from 'react';
import { getPhrase, getSet, PHRASES, PROFILE, SETS } from '../content';
import type { Navigation } from '../App';
import { SetCover } from '../components/SetCover';
import { Sheet } from '../components/Sheet';
import { dueLabel } from '../lib/progressLabel';
import { formatAgo } from '../state/clock';
import { HistoryEvent } from '../state/machine';
import { TARGET_RETENTION } from '../state/memory';
import { duePhraseIds, learnerStats, nextDue, recentSetIds, setProgress, suggestedSetId } from '../state/selectors';
import { useNow, useStore } from '../state/store';

export function HomeScreen({ nav }: { nav: Navigation }) {
  const { state } = useStore();
  const now = useNow(30_000);
  const [historyOpen, setHistoryOpen] = useState(false);
  const stats = learnerStats(state.learner, now);
  const due = duePhraseIds(state.learner, now);
  const upcoming = nextDue(state.learner, now);
  const recent = recentSetIds(state.learner);
  const suggested = suggestedSetId(state.learner, now);
  const suggestedSet = suggested ? getSet(suggested) : null;
  const suggestedProgress = suggested ? setProgress(state.learner, suggested, now) : null;
  const recallPercent = Math.round(TARGET_RETENTION * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-7">
      <section>
        <h1 className="font-serif text-[28px] italic font-medium leading-tight">¡Hola, {PROFILE.name}!</h1>
        {stats.started === 0 && (
          <p className="text-sm text-secondary mt-1">Listen to a phrase, then say it before you hear it again.</p>
        )}
        <dl className="grid grid-cols-2 mt-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 divide-x divide-outline-variant/40">
          <Stat label="Learned" value={`${stats.learned} of ${PHRASES.length}`} icon="verified" />
          <Stat label="Due now" value={String(stats.due)} icon="schedule" />
        </dl>
      </section>

      <section aria-labelledby="review-heading">
        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          {due.length > 0 ? (
            <>
              <h2 id="review-heading" className="font-serif text-lg font-bold">Review</h2>
              <p className="text-sm text-secondary mt-0.5">
                {due.length} {due.length === 1 ? 'phrase has' : 'phrases have'} dropped to {recallPercent}% recall
              </p>
            </>
          ) : (
            suggestedSet &&
            suggestedProgress && (
              <>
                <h2 id="review-heading" className="font-serif text-lg font-bold">
                  {stats.started === 0 ? 'Start here' : 'Keep going'}
                </h2>
                <p className="text-sm text-secondary mt-0.5">
                  {suggestedSet.title} · {suggestedProgress.learned} of {suggestedProgress.total} learned
                </p>
              </>
            )
          )}
          {(due.length > 0 || suggestedSet) && (
            <button
              type="button"
              onClick={() => (due.length > 0 ? nav.playList(due) : nav.playSet(suggestedSet!.id))}
              className="mt-3 min-h-12 px-5 rounded-full bg-primary-container text-on-primary font-bold inline-flex items-center gap-2 active:opacity-90"
            >
              <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[22px]">play_arrow</span>
              {due.length > 0 ? 'Play review' : `Play ${suggestedProgress!.total} phrases`}
            </button>
          )}
        </div>
        {upcoming && (
          <p className="text-sm text-secondary mt-2 px-1 flex items-center gap-1.5">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">schedule</span>
            Next: {upcoming.count} {upcoming.count === 1 ? 'phrase' : 'phrases'} {dueLabel(upcoming.at, now)}
          </p>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="recent-heading" className="font-serif text-xl font-semibold">Jump back in</h2>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="min-h-11 px-3 -mr-2 rounded-full text-sm font-semibold text-primary-container flex items-center gap-1 active:bg-surface-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">history</span>
              History
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((setId) => {
              const set = getSet(setId);
              const progress = setProgress(state.learner, setId, now);
              return (
                <li key={setId}>
                  <button
                    type="button"
                    onClick={() => nav.openSet(setId)}
                    className="w-full min-h-16 flex items-center gap-3 p-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-left active:bg-surface-container-low"
                  >
                    <SetCover set={set} size="sm" className="w-12 h-12 rounded-xl shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{set.title}</span>
                      <span className="block text-xs text-secondary">
                        {progress.learned} of {progress.total} learned{progress.due > 0 ? ` · ${progress.due} due` : ''}
                      </span>
                    </span>
                    <span aria-hidden="true" className="material-symbols-outlined text-secondary">chevron_right</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="sets-heading">
        <h2 id="sets-heading" className="font-serif text-xl font-semibold mb-2">Sets</h2>
        <ul className="scroll-row flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pb-2">
          {SETS.map((set) => {
            const progress = setProgress(state.learner, set.id, now);
            return (
              <li key={set.id} className="snap-start shrink-0 w-40">
                <button type="button" onClick={() => nav.openSet(set.id)} className="w-full text-left">
                  <SetCover set={set} size="md" className="w-40 h-40 rounded-2xl shadow-sm" />
                  <span className="block text-sm font-bold mt-2 truncate">{set.title}</span>
                  <span className="block text-xs text-secondary">
                    {progress.learned} of {progress.total} learned
                  </span>
                  <span className="block h-1.5 mt-1.5 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true">
                    <span
                      className="block h-full bg-primary-container rounded-full"
                      style={{ width: `${progress.total === 0 ? 0 : (progress.learned / progress.total) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} now={now} />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-center py-3 gap-0.5">
      <dt className="flex items-center gap-1 text-xs font-semibold text-secondary">
        <span className="material-symbols-outlined text-[18px] text-primary-container" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums leading-tight">{value}</dd>
    </div>
  );
}

const EVENT_LABEL: Record<HistoryEvent, string> = {
  heard: 'Listened',
  hard: 'Rated Hard',
  easy: 'Rated Easy',
  learned: 'Learned',
};

function HistorySheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const { state } = useStore();
  const entries = [...state.learner.history].reverse().slice(0, 50);
  return (
    <Sheet open={open} title="History" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="text-sm text-secondary py-4">Nothing played yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-container-high">
          {entries.map((entry, i) => {
            const phrase = getPhrase(entry.phraseId);
            return (
              <li key={`${entry.at}-${i}`} className="py-2.5 flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span lang={phrase.target.lang} className="block font-serif italic text-[15px] truncate">
                    {phrase.target.text}
                  </span>
                  <span className="block text-xs text-secondary">
                    {EVENT_LABEL[entry.event]} · {formatAgo(now - entry.at)}
                  </span>
                </span>
                <span className="text-sm font-bold text-primary-container tabular-nums">+{entry.points}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
