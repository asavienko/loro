import { useState } from 'react';
import { greeting } from '../copy';
import { useNav } from '../nav/NavContext';
import { coursePhrases, courseSets, findSetView, SetView } from '../state/catalog';
import { formatAgo, formatElapsed, formatWhen } from '../state/clock';
import {
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
} from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { SetCard } from '../ui/SetCard';
import { SetCover } from '../ui/SetCover';
import { Sheet } from '../ui/Sheet';

export function HomeScreen() {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const now = useNow(30_000);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { learner } = state;
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
  const courseTotal = coursePhrases(learner).length;
  // Nothing due and nothing left to learn: say so, and offer what to do next.
  const courseDone = courseTotal > 0 && due.length === 0 && suggestedIds.length === 0 && stats.learned === courseTotal;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-7">
      <section>
        <h1 lang={learner.profile.targetLang} className="font-serif text-display italic font-medium leading-tight">
          {greeting(learner.profile.targetLang, learner.profile.name)}
        </h1>
        {firstRun && <p className="text-body text-secondary mt-1">{c.home.firstRun}</p>}
        <div className="grid grid-cols-2 mt-4 rounded-2xl overflow-hidden bg-surface-container-low border border-outline-variant/40 divide-x divide-outline-variant/40">
          <Stat label={c.home.learned} value={stats.learned} icon="verified" onClick={() => nav.go({ name: 'library', view: 'learned' })} />
          <Stat label={c.home.started} value={stats.started} icon="headphones" onClick={() => nav.go({ name: 'library', view: 'learning' })} />
        </div>
        {today.heard + today.rated > 0 && <p className="text-body text-secondary mt-2 px-1">{c.home.today(today.heard, today.rated)}</p>}
      </section>

      {firstRun && firstPhrase && (
        <section aria-labelledby="demo-heading" className="rounded-3xl bg-primary-fixed/50 p-4">
          <h2 id="demo-heading" className="font-serif text-lg font-bold">{c.home.demoTitle}</h2>
          <p className="text-body text-on-surface-variant mt-0.5">{c.home.demoBody}</p>
          <button
            type="button"
            onClick={() => {
              nav.playList([firstPhrase]);
              nav.openPlayer();
            }}
            className="mt-3 min-h-12 px-5 rounded-full bg-primary-container text-on-primary font-bold inline-flex items-center gap-2"
          >
            <Icon name="play_arrow" fill className="text-icon" />
            {c.home.demoButton}
          </button>
        </section>
      )}

      <section aria-label={c.home.reviewTitle} className="flex flex-col gap-3">
        {due.length > 0 && (
          <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <h2 className="font-serif text-lg font-bold">{c.home.reviewTitle}</h2>
            <p className="text-body text-secondary mt-0.5">
              {c.home.reviewBody(due.length)}
              {due.length > review.length && ` ${c.home.reviewCapped(review.length)}`}
            </p>
            <PlayButton
              label={c.home.playPhrases(review.length)}
              detail={reviewMs === null ? null : c.home.duration(formatElapsed(reviewMs))}
              onClick={() => nav.playList(review)}
            />
          </div>
        )}
        {suggested && suggestedProgress && suggestedIds.length > 0 && (
          <div className={`rounded-3xl border border-outline-variant p-4 ${due.length > 0 || firstRun ? 'bg-surface-container-low' : 'bg-surface-container-lowest shadow-sm'}`}>
            <h2 className="font-serif text-lg font-bold">{stats.started === 0 ? c.home.startTitle : c.home.continueTitle}</h2>
            <p className="text-body text-secondary mt-0.5">
              {c.home.continueBody(suggested.title, suggestedProgress.learned, suggestedProgress.total)}
            </p>
            <PlayButton
              secondary={due.length > 0 || (firstRun && Boolean(firstPhrase))}
              label={c.home.playPhrases(suggestedIds.length)}
              detail={null}
              onClick={() => nav.playSet(suggested.id, { phraseIds: suggestedIds })}
            />
          </div>
        )}
        {courseDone && (
          <div className="rounded-3xl bg-tertiary-fixed/60 p-4">
            <h2 className="font-serif text-lg font-bold flex items-center gap-2">
              <Icon name="task_alt" className="text-icon text-tertiary" />
              {c.home.courseDoneTitle}
            </h2>
            <p className="text-body text-on-surface-variant mt-1">{c.home.courseDoneBody}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={nav.addPhrase} className="min-h-11 px-4 rounded-full bg-primary-container text-on-primary font-bold flex items-center gap-1.5">
                <Icon name="add" className="text-icon-md" />
                {c.home.addOwn}
              </button>
              <button type="button" onClick={nav.openSettings} className="min-h-11 px-4 rounded-full bg-surface-container-high text-on-surface font-semibold">
                {c.home.otherCourse}
              </button>
            </div>
          </div>
        )}
        {upcoming && (
          <p className="text-body text-secondary px-1 flex items-center gap-1.5">
            <Icon name="schedule" className="text-icon-sm" />
            {c.home.next(upcoming.count, formatWhen(upcoming.at, now, c.locale))}
          </p>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="recent-heading" className="font-serif text-heading font-semibold">{c.home.jumpBackIn}</h2>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="min-h-11 px-3 -mr-2 rounded-full text-body font-semibold text-primary-container flex items-center gap-1 active:bg-surface-container"
            >
              <Icon name="history" className="text-icon-sm" />
              {c.home.history}
            </button>
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {recent.map((id) => {
              const view = findSetView(learner, id);
              return view ? <li key={id}><SetRow view={view} now={now} /></li> : null;
            })}
          </ul>
        </section>
      )}

      {fresh.length > 0 && (
        <section aria-labelledby="fresh-heading">
          <h2 id="fresh-heading" className="font-serif text-heading font-semibold mb-2">{c.home.notStarted}</h2>
          <ul className="scroll-row flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pb-2">
            {fresh.map((set) => {
              const view = findSetView(learner, set.id)!;
              return (
                <li key={set.id} className="snap-start shrink-0">
                  <SetCard view={view} progress={setProgress(learner, set.phraseIds, now)} onOpen={() => nav.openSet(set.id)} onPlay={() => nav.playSet(set.id)} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recent.length === 0 && !firstRun && (
        <button type="button" onClick={() => setHistoryOpen(true)} className="self-start min-h-11 px-3 -ml-3 rounded-full text-body font-semibold text-primary-container flex items-center gap-1">
          <Icon name="history" className="text-icon-sm" />
          {c.home.history}
        </button>
      )}

      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} now={now} />
    </div>
  );
}

function PlayButton({ label, detail, onClick, secondary = false }: { label: string; detail: string | null; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-3 min-h-12 px-5 py-2 rounded-3xl font-bold inline-flex flex-wrap items-center gap-x-2 text-left active:opacity-90 ${
        secondary ? 'bg-surface-container-high text-on-surface' : 'bg-primary-container text-on-primary'
      }`}
    >
      <Icon name="play_arrow" fill className="text-icon" />
      {label}
      {detail && <span className="font-medium opacity-80">· {detail}</span>}
    </button>
  );
}

function Stat({ label, value, icon, onClick }: { label: string; value: number; icon: 'verified' | 'headphones'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex flex-col items-center py-3 gap-0.5 active:bg-surface-container">
      <span className="flex items-center gap-1 text-label font-semibold text-secondary">
        <Icon name={icon} className="text-icon-sm text-primary-container" />
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums leading-tight">{value}</span>
    </button>
  );
}

function SetRow({ view, now }: { view: SetView; now: number }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const progress = setProgress(state.learner, view.phraseIds, now);
  return (
    <button
      type="button"
      onClick={() => nav.openSet(view.id)}
      className="w-full min-h-16 flex items-center gap-3 p-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-left active:bg-surface-container-low"
    >
      <SetCover set={view} size="sm" className="w-12 h-12 rounded-xl shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-row font-semibold truncate">{view.title}</span>
        <span className="block text-label text-secondary">{c.set.summary(progress.total, progress.learned, progress.due)}</span>
      </span>
      <Icon name="chevron_right" className="text-icon text-secondary" />
    </button>
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
        <p className="text-body text-secondary py-4">{c.history.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {runs.map((run) => {
            const view = findSetView(state.learner, run.setId);
            const label = view?.title ?? c.history.mixed;
            return (
              <li key={`${run.setId}-${run.from}`}>
                <button
                  type="button"
                  disabled={!view}
                  onClick={() => {
                    if (!view) return;
                    onClose();
                    nav.openSet(view.id);
                  }}
                  className="w-full min-h-14 py-2 flex items-center gap-3 text-left rounded-xl active:bg-surface-container"
                >
                  <SetCover set={view ?? { topicId: null, coverIcon: 'queue_music' }} size="sm" className="w-10 h-10 rounded-lg shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-row font-semibold truncate">{label}</span>
                    <span className="block text-label text-secondary">
                      {c.history.run(run.phrases, run.points)} · {formatAgo(run.to, now, c.locale)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
