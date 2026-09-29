// Two small charts drawn from state (the web prototype's src/ui/Charts.tsx). Each bar's size is its
// count over the largest count, and the same number is written beside it. A screen reader gets each
// row as one sentence; the drawing itself is hidden from it.
import { StyleSheet, View } from 'react-native';
import { formatShortDate } from '@shared/state/clock';
import type { RecallBucket } from '@shared/state/selectors';
import { useCopy } from '../state/store';
import { Txt } from './Txt';
import { colors, radius } from './theme';

/** The weekly chart's bars fill at most this share of its height, leaving room for the count. */
const WEEK_BAR_SHARE = 0.7;
const WEEK_CHART_HEIGHT = 96;

export function RecallChart({ buckets }: { buckets: RecallBucket[] }) {
  const c = useCopy();
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  return (
    <View style={styles.figure}>
      <Txt variant="label" weight={600} color="secondary" style={styles.caption}>
        {c.library.recallChart}
      </Txt>
      {total === 0 ? (
        <Txt color="secondary">{c.library.recallChartEmpty}</Txt>
      ) : (
        <View style={styles.rows}>
          {buckets.map((b) => {
            const label = b.from === 0 ? c.library.recallBelow(b.to) : c.library.recallBucket(b.from, b.to);
            return (
              <View key={b.from} accessible accessibilityLabel={c.library.bucketCount(label, b.count)} style={styles.row}>
                <Txt variant="label" color="secondary" style={styles.rowLabel}>
                  {label}
                </Txt>
                <View style={styles.track}>
                  <View style={[styles.bar, { width: `${(b.count / max) * 100}%` }]} />
                </View>
                <Txt variant="label" weight={700} align="right" style={styles.rowCount}>
                  {b.count}
                </Txt>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function WeeklyChart({ weeks }: { weeks: { weekStart: number; count: number }[] }) {
  const c = useCopy();
  const max = Math.max(1, ...weeks.map((w) => w.count));
  return (
    <View style={styles.figure}>
      <Txt variant="label" weight={600} color="secondary" style={styles.caption}>
        {c.library.weeklyChart}
      </Txt>
      <View style={styles.weeks}>
        {weeks.map((w) => (
          <View key={w.weekStart} accessible accessibilityLabel={c.library.weekOf(formatShortDate(w.weekStart, c.locale), w.count)} style={styles.week}>
            <Txt variant="caption" weight={700}>
              {w.count}
            </Txt>
            <View style={[styles.weekBar, { height: `${(w.count / max) * WEEK_BAR_SHARE * 100}%` }]} />
          </View>
        ))}
      </View>
      {weeks.length > 0 && (
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.axis}>
          <Txt variant="caption" color="secondary">
            {formatShortDate(weeks[0].weekStart, c.locale)}
          </Txt>
          <Txt variant="caption" color="secondary">
            {formatShortDate(weeks[weeks.length - 1].weekStart, c.locale)}
          </Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, padding: 12 },
  caption: { marginBottom: 8 },
  rows: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { width: 72 },
  track: { flex: 1, height: 12, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.full, backgroundColor: colors.tertiaryContainer },
  rowCount: { width: 32 },
  weeks: { height: WEEK_CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  week: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  weekBar: { width: '100%', minHeight: 1, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: colors.tertiaryContainer },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
