import { formatWhen } from '../state/clock';
import { sessionSummary } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { StatTile } from '../ui/StatTile';

/**
 * What this session did, all from the log: phrases, repetitions, ratings, points, next review.
 * Only figures that say something: nothing played is one line, not a wall of zeros; "times
 * through the queue" appears once there has been one.
 */
export function SessionSummarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(5_000);
  const summary = open ? sessionSummary(state, now) : null;
  const rated = summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0;
  const played = Boolean(summary && summary.phrasesPlayed > 0);
  const next = !summary
    ? null
    : summary.dueNow > 0
      ? c.home.reviewBody(summary.dueNow)
      : summary.nextDue
        ? `${c.common.phrases(summary.nextDue.count)} · ${formatWhen(summary.nextDue.at, now, c.locale)}`
        : // With ratings still changeable and nothing scheduled, the note under Ratings says why;
          // "Nothing scheduled yet" beside them would read as a contradiction.
          summary.pendingRatings > 0
          ? null
          : c.summary.nothingDue;
  const nextCard = next !== null && (
    <div className="col-span-2 rounded-2xl bg-surface-container-low p-3">
      <dt className="text-label font-semibold text-secondary">{c.summary.nextDue}</dt>
      <dd className="text-body mt-0.5">{next}</dd>
    </div>
  );
  return (
    <Sheet open={open} title={c.summary.title} onClose={onClose}>
      {/* Opened with no session (a toast's action after the queue was cleared), or before anything played. */}
      {open && !played && <p className="text-body text-secondary">{c.summary.none}</p>}
      {summary && (played || rated > 0 || nextCard) && (
        // Without a pass, "Points earned" takes the row the passes tile would share.
        <dl className={`grid grid-cols-2 gap-2 ${played ? '' : 'mt-3'} ${summary.passes > 0 ? '' : '[&>*:nth-child(3)]:col-span-2'}`}>
          {played && (
            <>
              <StatTile label={c.summary.phrases} value={String(summary.phrasesPlayed)} />
              <StatTile label={c.summary.repetitions} value={String(summary.repetitions)} />
              <StatTile label={c.summary.points} value={`+${summary.points}`} />
              {summary.passes > 0 && <StatTile label={c.summary.passes} value={String(summary.passes)} />}
            </>
          )}
          {(played || rated > 0) && (
            <div className="col-span-2 rounded-2xl bg-surface-container-low p-3">
              <dt className="text-label font-semibold text-secondary">{c.summary.ratings}</dt>
              <dd className="text-body mt-0.5">
                {/* No-break spaces keep each grade with its count and the dot at the end of a line. */}
                {(['missed', 'hard', 'easy'] as const).map((g) => `${c.common.grade[g]}\u00a0${summary.ratings[g]}`).join('\u00a0· ')}
                {summary.pendingRatings > 0 && <span className="block text-label text-secondary">{c.summary.pending(summary.pendingRatings)}</span>}
              </dd>
            </div>
          )}
          {nextCard}
        </dl>
      )}
    </Sheet>
  );
}
