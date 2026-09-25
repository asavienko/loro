import { ReactNode, useState } from 'react';
import { useNav } from '../nav/NavContext';
import { coursePhrases, courseSets, findSetView } from '../state/catalog';
import { formatAgo, formatElapsed, formatWhen } from '../state/clock';
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
} from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { SetCard } from '../ui/SetCard';
import { SetCover } from '../ui/SetCover';
import { SetRow } from '../ui/SetRow';
import { Sheet } from '../ui/Sheet';
import { StatChip } from '../ui/StatTile';
import { btnIcon, btnPrimary, btnText, btnTonal } from '../ui/button';

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
  // New to Loro: nothing heard in any course (a course switched to later is not a first run),
  // and the demo not declined in onboarding. Only then the demo and the first-run line.
  const newToLoro = !state.prefs.skippedDemo && !state.learner.log.some((entry) => entry.kind === 'heard');
  const offerDemo = newToLoro && Boolean(firstPhrase);
  const courseTotal = coursePhrases(learner).length;
  // Nothing due and nothing left to learn: say so, and offer what to do next.
  const courseDone = courseTotal > 0 && due.length === 0 && suggestedIds.length === 0 && stats.learned === courseTotal;

  // Exactly one hero, the first that applies: the demo, the review, what to continue, the course done.
  const hero = offerDemo && firstPhrase ? 'demo' : due.length > 0 ? 'review' : suggested && suggestedIds.length > 0 ? 'continue' : courseDone ? 'done' : null;
  const continueTitle = stats.started === 0 ? c.home.startTitle : c.home.continueTitle;
  const continueMeta = suggestedProgress ? c.set.summary(suggestedProgress.total, suggestedProgress.learned, suggestedProgress.due) : '';
  // Home's study plays open the player, as the demo does, so the learner sees the grades to rate
  // (quick-play on cards elsewhere stays in the mini-player).
  const playContinue = () => {
    if (!suggested) return;
    nav.playSet(suggested.id, { phraseIds: suggestedIds });
    nav.openPlayer();
  };
  // With more due than the review plays, the next due date isn't what comes next: say nothing.
  // With reviews due now, the next ones come after them ("After these"), inside the review.
  const nextLine = upcoming && due.length <= review.length ? (review.length > 0 ? c.home.nextAfter : c.home.next)(upcoming.count, formatWhen(upcoming.at, now, c.locale)) : null;

  return (
    // One column (a reading measure once the screen is wider than that), then two once there's room
    // at the current text size: what to play now on the left, staying in view, and what else there
    // is on the right. A container query, so 200% text on a tablet stays one column rather than
    // spilling sideways. The header lines up with it (App HOME_COLUMN, the same query).
    <div className="@container">
      <div className="max-w-2xl @min-[56rem]:max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-7 @min-[56rem]:grid @min-[56rem]:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @min-[56rem]:gap-x-10 @min-[56rem]:items-start">
        <div className="flex flex-col gap-7 @min-[56rem]:sticky @min-[56rem]:top-[calc(4.5rem+env(safe-area-inset-top))]">
          {newToLoro && <p className="text-body text-secondary -mb-3">{c.home.firstRun}</p>}

          {hero === 'demo' && firstPhrase && (
            <Hero labelledBy="demo-heading">
              <h2 id="demo-heading" className={EYEBROW}>{c.home.demoTitle}</h2>
              <p className={HERO_TITLE}>{c.home.demoBody}</p>
              <PlayButton
                label={c.home.demoButton}
                detail={null}
                onClick={() => {
                  nav.playList([firstPhrase]);
                  nav.openPlayer();
                }}
              />
            </Hero>
          )}

          {hero === 'review' && (
            <Hero labelledBy="review-heading">
              <h2 id="review-heading" className={EYEBROW}>{c.home.reviewTitle}</h2>
              <p className={HERO_TITLE}>{c.home.reviewBody(due.length)}</p>
              {due.length > review.length && <p className="text-body text-on-surface-variant mt-1">{c.home.reviewCapped(review.length)}</p>}
              <PlayButton
                label={c.home.playPhrases(review.length)}
                detail={reviewMs === null ? null : c.home.duration(formatElapsed(reviewMs))}
                onClick={() => {
                  nav.playList(review);
                  nav.openPlayer();
                }}
              />
              {nextLine && <NextLine text={nextLine} className="mt-3 text-on-surface-variant" />}
            </Hero>
          )}

          {hero === 'continue' && suggested && (
            <Hero labelledBy="continue-heading">
              <h2 id="continue-heading" className={EYEBROW}>{continueTitle}</h2>
              <button type="button" onClick={() => nav.openSet(suggested.id)} className="mt-2 -mx-2 px-2 py-1 w-[calc(100%+1rem)] flex items-center gap-3 text-left rounded-2xl active:bg-primary-fixed/60">
                <SetCover set={suggested} size="sm" className="w-14 h-14 rounded-xl shrink-0 shadow-cover" />
                <span className="min-w-0">
                  <span lang={suggested.targetLang} className="block font-serif text-display-sm font-semibold leading-tight [overflow-wrap:anywhere]">{suggested.title}</span>
                  <span className="block text-label text-on-surface-variant mt-0.5">{continueMeta}</span>
                </span>
              </button>
              <PlayButton label={c.home.playPhrases(suggestedIds.length)} detail={null} onClick={playContinue} />
            </Hero>
          )}

          {hero === 'done' && (
            <Hero labelledBy="done-heading" tone="tertiary">
              <Icon name="task_alt" className="block text-icon-xl text-tertiary mb-1" />
              <h2 id="done-heading" className="font-serif text-display-sm font-semibold">{c.home.courseDoneTitle}</h2>
              <p className="text-body text-on-surface-variant mt-1">{c.home.courseDoneBody}</p>
              <button type="button" onClick={() => nav.addPhrase()} className={`${btnPrimary} w-full mt-4`}>
                <Icon name="add" className="text-icon" />
                {c.home.addOwn}
              </button>
              <button type="button" onClick={nav.openSettings} className={`${btnTonal} w-full mt-2`}>
                {c.home.otherCourse}
              </button>
            </Hero>
          )}

          {/* Behind a demo or a review, what to continue is a row with a quiet Play of its own. */}
          {hero !== 'continue' && suggested && suggestedIds.length > 0 && (
            <section aria-labelledby="continue-heading">
              <h2 id="continue-heading" className="font-serif text-heading font-semibold mb-1">{continueTitle}</h2>
              <SetRow
                set={suggested}
                meta={continueMeta}
                onOpen={() => nav.openSet(suggested.id)}
                action={
                  <button type="button" onClick={playContinue} aria-label={c.home.playPhrases(suggestedIds.length)} className={`${btnIcon} bg-surface-container-high text-on-surface`}>
                    <Icon name="play_arrow" fill className="text-icon" />
                  </button>
                }
              />
            </section>
          )}

          {/* Quiet figures: none on a first run (three zeros say nothing). */}
          {(!firstRun || today.heard + today.rated > 0 || (nextLine && hero !== 'review')) && (
            <div className="flex flex-col gap-2">
              {!firstRun && (
                <div className="flex flex-wrap gap-2">
                  <StatChip label={c.home.learned} value={stats.learned} icon="verified" onClick={() => nav.go({ name: 'library', view: 'learned' })} />
                  <StatChip label={c.home.started} value={stats.started} icon="headphones" onClick={() => nav.go({ name: 'library', view: 'learning' })} />
                </div>
              )}
              {today.heard + today.rated > 0 && <p className="text-label text-secondary px-1">{c.home.today(today.heard, today.rated)}</p>}
              {nextLine && hero !== 'review' && <NextLine text={nextLine} className="px-1 text-secondary" />}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-7">
          {recent.length > 0 && (
            <section aria-labelledby="recent-heading">
              <div className="flex items-center justify-between mb-1">
                <h2 id="recent-heading" className="font-serif text-heading font-semibold">{c.home.jumpBackIn}</h2>
                <button type="button" onClick={() => setHistoryOpen(true)} className={`${btnText} -mr-2`}>
                  <Icon name="history" className="text-icon-sm" />
                  {c.home.history}
                </button>
              </div>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-x-8">
                {recent.map((id) => {
                  const view = findSetView(learner, id);
                  if (!view) return null;
                  const progress = setProgress(learner, view.phraseIds, now);
                  return (
                    <li key={id}>
                      <SetRow set={view} meta={c.set.summary(progress.total, progress.learned, progress.due)} onOpen={() => nav.openSet(view.id)} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {fresh.length > 0 && (
            <section aria-labelledby="fresh-heading">
              <h2 id="fresh-heading" className="font-serif text-heading font-semibold mb-2">{c.home.notStarted}</h2>
              {/* A shelf on a phone; a grid of cards at least 10rem wide once there's room for it. */}
              <ul className="scroll-row flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 pb-2 @min-[56rem]:grid @min-[56rem]:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] @min-[56rem]:gap-x-4 @min-[56rem]:gap-y-6 @min-[56rem]:overflow-visible @min-[56rem]:mx-0 @min-[56rem]:px-0">
                {fresh.map((set) => {
                  const view = findSetView(learner, set.id)!;
                  return (
                    <li key={set.id} className="snap-start shrink-0 w-40 @min-[56rem]:w-auto">
                      <SetCard wide view={view} progress={setProgress(learner, set.phraseIds, now)} onOpen={() => nav.openSet(set.id)} onPlay={() => nav.playSet(set.id)} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {recent.length === 0 && !firstRun && (
            <button type="button" onClick={() => setHistoryOpen(true)} className={`${btnText} self-start -ml-3`}>
              <Icon name="history" className="text-icon-sm" />
              {c.home.history}
            </button>
          )}
        </div>

        <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} now={now} />
      </div>
    </div>
  );
}

const EYEBROW = 'text-label font-semibold text-on-primary-fixed-variant';
const HERO_TITLE = 'font-serif text-display-sm font-semibold mt-1 [overflow-wrap:anywhere]';
// The primary pill, full width. Its label can wrap (a small phone, large text), and a wrapped pill
// would turn into an oval that cuts its corners off: its radius stops at the pill's own at one line.
const HERO_PLAY = `${btnPrimary.replace('rounded-full', 'rounded-3xl')} w-full mt-4 py-2`;

/** The one hero on Home: a wash, no border, and one full-width Play. */
function Hero({ labelledBy, tone = 'primary', children }: { labelledBy: string; tone?: 'primary' | 'tertiary'; children: ReactNode }) {
  return (
    // A container, so the padding gives way to the content on a small phone or at large text.
    <section aria-labelledby={labelledBy} className={`@container rounded-2xl ${tone === 'tertiary' ? 'bg-tertiary-fixed/60' : 'bg-primary-fixed/45'}`}>
      <div className="p-5 @max-[22rem]:p-4 @max-[14rem]:p-3">{children}</div>
    </section>
  );
}

function PlayButton({ label, detail, onClick }: { label: string; detail: string | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={HERO_PLAY}>
      <Icon name="play_arrow" fill className="text-icon" />
      {/* A no-break space keeps "·" on the label's line when the detail wraps. */}
      <span className="min-w-0">
        {label}
        {detail && (
          <span className="font-medium opacity-80">
            {'\u00a0· '}
            <span className="whitespace-nowrap">{detail}</span>
          </span>
        )}
      </span>
    </button>
  );
}

function NextLine({ text, className }: { text: string; className: string }) {
  return (
    <p className={`text-label flex items-start gap-1.5 ${className}`}>
      <Icon name="schedule" className="text-icon-xs shrink-0" />
      {text}
    </p>
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
            return (
              <li key={`${run.setId}-${run.from}`}>
                <SetRow
                  set={view ?? { title: c.history.mixed, topicId: null, coverIcon: 'queue_music' }}
                  meta={`${c.history.run(run.phrases, run.points)} · ${formatAgo(run.to, now, c.locale)}`}
                  disabled={!view}
                  onOpen={() => {
                    if (!view) return;
                    onClose();
                    nav.openSet(view.id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
