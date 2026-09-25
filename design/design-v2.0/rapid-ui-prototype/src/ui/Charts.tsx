// Two small charts drawn from state. Each bar's size is its count over the
// largest count, and the same numbers are in the text beside it (e2e/render
// checks the geometry against the words). A screen reader gets each item as
// sr-only text: some ignore aria-label on a list item and would read it empty.
import { formatShortDate } from '../state/clock';
import type { RecallBucket } from '../state/selectors';
import { useCopy } from '../state/store';

export function RecallChart({ buckets }: { buckets: RecallBucket[] }) {
  const c = useCopy();
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  return (
    <figure className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-3">
      <figcaption className="text-body font-bold mb-2">{c.library.recallChart}</figcaption>
      {total === 0 ? (
        <p className="text-body text-secondary">{c.library.recallChartEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5" data-chart="recall">
          {buckets.map((b) => {
            const label = b.from === 0 ? c.library.recallBelow(b.to) : c.library.recallBucket(b.from, b.to);
            return (
              <li key={b.from} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-label">
                <span className="sr-only">{c.library.bucketCount(label, b.count)}</span>
                <span aria-hidden="true" className="text-secondary tabular-nums">{label}</span>
                <span aria-hidden="true" className="h-3 rounded-full bg-surface-container-high overflow-hidden">
                  <span data-bar data-count={b.count} data-max={max} className="block h-full rounded-full bg-primary-container" style={{ width: `${(b.count / max) * 100}%` }} />
                </span>
                <span aria-hidden="true" className="text-right font-bold tabular-nums">{b.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export function WeeklyChart({ weeks }: { weeks: { weekStart: number; count: number }[] }) {
  const c = useCopy();
  const max = Math.max(1, ...weeks.map((w) => w.count));
  return (
    <figure className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-3">
      <figcaption className="text-body font-bold mb-2">{c.library.weeklyChart}</figcaption>
      <ul className="h-24 flex items-end gap-1.5" data-chart="weekly">
        {weeks.map((w) => {
          const date = formatShortDate(w.weekStart, c.locale);
          return (
            <li key={w.weekStart} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
              <span className="sr-only">{c.library.weekOf(date, w.count)}</span>
              <span aria-hidden="true" className="text-caption font-bold tabular-nums">{w.count}</span>
              <span
                aria-hidden="true"
                data-bar
                data-count={w.count}
                data-max={max}
                className="w-full rounded-t-md bg-tertiary-container min-h-px"
                style={{ height: `${(w.count / max) * 70}%` }}
              />
            </li>
          );
        })}
      </ul>
      <p aria-hidden="true" className="flex justify-between text-caption text-secondary mt-1">
        <span>{formatShortDate(weeks[0].weekStart, c.locale)}</span>
        <span>{formatShortDate(weeks[weeks.length - 1].weekStart, c.locale)}</span>
      </p>
    </figure>
  );
}
