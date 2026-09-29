// What this session did, all from the log (the web prototype's src/sheets/SessionSummarySheet.tsx):
// phrases, repetitions, ratings, points, next review. Only figures that say something: nothing
// played is one line, not a wall of zeros; "times through the queue" appears once there has been one.
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatWhen } from '@shared/state/clock';
import { sessionSummary } from '@shared/state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Sheet } from '../ui/Sheet';
import { StatTile } from '../ui/StatTile';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

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
  return (
    <Sheet open={open} title={c.summary.title} onClose={onClose}>
      {/* Opened with no session (a toast's action after the queue was cleared), or before anything played. */}
      {open && !played && <Txt color="secondary">{c.summary.none}</Txt>}
      {summary && (played || rated > 0 || next !== null) && (
        <View style={[styles.grid, !played && styles.apart]}>
          {played && (
            <>
              <View style={styles.half}>
                <StatTile label={c.summary.phrases} value={String(summary.phrasesPlayed)} />
              </View>
              <View style={styles.half}>
                <StatTile label={c.summary.repetitions} value={String(summary.repetitions)} />
              </View>
              {/* Without a pass, "Points earned" takes the row the passes tile would share. */}
              <View style={summary.passes > 0 ? styles.half : styles.wide}>
                <StatTile label={c.summary.points} value={`+${summary.points}`} />
              </View>
              {summary.passes > 0 && (
                <View style={styles.half}>
                  <StatTile label={c.summary.passes} value={String(summary.passes)} />
                </View>
              )}
            </>
          )}
          {(played || rated > 0) && (
            <Card label={c.summary.ratings}>
              {/* No-break spaces keep each grade with its count and the dot at the end of a line. */}
              <Txt>{(['missed', 'hard', 'easy'] as const).map((g) => `${c.common.grade[g]}\u00a0${summary.ratings[g]}`).join('\u00a0· ')}</Txt>
              {summary.pendingRatings > 0 && (
                <Txt variant="label" color="secondary">
                  {c.summary.pending(summary.pendingRatings)}
                </Txt>
              )}
            </Card>
          )}
          {next !== null && (
            <Card label={c.summary.nextDue}>
              <Txt>{next}</Txt>
            </Card>
          )}
        </View>
      )}
    </Sheet>
  );
}

/** A labelled card across the grid, read as one: "Ratings, Missed 1 · Hard 0 · Easy 2". */
function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessible style={[styles.wide, styles.card]}>
      <Txt variant="label" weight={600} color="secondary">
        {label}
      </Txt>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  apart: { marginTop: 12 },
  half: { flexBasis: '47%', flexGrow: 1 },
  wide: { flexBasis: '100%' },
  card: { borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, padding: 12 },
  cardBody: { marginTop: 2 },
});
