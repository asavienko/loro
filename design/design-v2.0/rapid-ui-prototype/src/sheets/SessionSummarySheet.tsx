import { formatWhen } from '../state/clock';
import { sessionSummary } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { StatTile } from '../ui/StatTile';

/** What this session did, all from the log: phrases, repetitions, ratings, points, next review. */
export function SessionSummarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { state } = useStore();
  const now = useNow(5_000);
  const summary = open ? sessionSummary(state, now) : null;
  return (
    <Sheet open={open} title={c.summary.title} onClose={onClose}>
      {/* Opened with no session (a toast's action after the queue was cleared): say so. */}
      {open && !summary && <p className="text-body text-secondary">{c.summary.none}</p>}
      {summary && (
        <dl className="grid grid-cols-2 gap-2">
          <StatTile label={c.summary.phrases} value={String(summary.phrasesPlayed)} />
          <StatTile label={c.summary.repetitions} value={String(summary.repetitions)} />
          <StatTile label={c.summary.points} value={`+${summary.points}`} />
          <StatTile label={c.summary.passes} value={String(summary.passes)} />
          <div className="col-span-2 rounded-2xl bg-surface-container-low p-3">
            <dt className="text-label font-semibold text-secondary">{c.summary.ratings}</dt>
            <dd className="text-body mt-0.5">
              {/* No-break spaces keep each grade with its count and the dot at the end of a line. */}
              {(['missed', 'hard', 'easy'] as const).map((g) => `${c.common.grade[g]}\u00a0${summary.ratings[g]}`).join('\u00a0· ')}
              {summary.pendingRatings > 0 && <span className="block text-label text-secondary">{c.summary.pending(summary.pendingRatings)}</span>}
            </dd>
          </div>
          <div className="col-span-2 rounded-2xl bg-surface-container-low p-3">
            <dt className="text-label font-semibold text-secondary">{c.summary.nextDue}</dt>
            <dd className="text-body mt-0.5">
              {summary.dueNow > 0
                ? c.home.reviewBody(summary.dueNow)
                : summary.nextDue
                  ? `${c.common.phrases(summary.nextDue.count)} · ${formatWhen(summary.nextDue.at, now, c.locale)}`
                  : c.summary.nothingDue}
            </dd>
          </div>
        </dl>
      )}
    </Sheet>
  );
}
