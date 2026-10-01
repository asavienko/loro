// Rating in the players (plan 107), a phrase's and a song's alike: Missed / Hard / Easy, never
// preselected and without times, since FSRS sets when a phrase comes back. Over the grades, one line
// says what to do. Once a grade is given the grades go for the rating's window: in their place, the
// grade given, what it did and Undo.
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Grade } from '@shared/state/types';
import { useCopy } from '../state/store';
import { Button } from './Button';
import { GRADES } from './grades';
import { Icon } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';
import { radius, TARGET } from './theme';
import { useRoom } from './useRoom';

const GRADE_HEIGHT = 52;

/** The three grades. */
export function GradeRow({ onRate }: { onRate: (grade: Grade) => void }) {
  const c = useCopy();
  const { compact } = useRoom();
  return (
    <View style={[styles.grades, compact && styles.gradesCompact]}>
      {GRADES.map(({ grade, icon, bg, ink }) => (
        <Press
          key={grade}
          accessibilityRole="button"
          haptic="none"
          onPress={() => onRate(grade)}
          style={({ pressed }) => [styles.grade, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
        >
          {/* A compact screen keeps the words whole and lets the colours tell the grades apart. */}
          {!compact && <Icon name={icon} size="sm" color={ink} />}
          <Txt weight={600} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
            {c.common.grade[grade]}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

/** The line over the grades: as tall whatever it says, so nothing moves as a rating comes and goes. */
export function RatingLine({ children }: { children: ReactNode }) {
  return <View style={styles.line}>{children}</View>;
}

/** What a rating did, in a few words, and Undo. */
export function RatedLine({ text, undo }: { text: string; undo: { label: string; accessibilityLabel?: string; onPress: () => void } }) {
  return (
    <RatingLine>
      <View accessible accessibilityLiveRegion="polite" style={styles.said}>
        <Icon name="check_circle" size="sm" fill color="tertiaryContainer" />
        <Txt variant="label" weight={500} color="onSurfaceVariant" numberOfLines={2} style={styles.shrink}>
          {text}
        </Txt>
      </View>
      <Button variant="text" icon="undo" label={undo.label} accessibilityLabel={undo.accessibilityLabel} onPress={undo.onPress} style={styles.undo} />
    </RatingLine>
  );
}

/**
 * In place of the line and the grades while a rating's window is open: the grade given, what it did,
 * and Undo. As tall as the two together, so nothing on the page moves as a rating comes and goes.
 */
export function RatedPanel({ grade, title, text, undo }: { grade: Grade; title: string; text: string; undo: { label: string; accessibilityLabel?: string; onPress: () => void } }) {
  const { bg, ink } = GRADES.find((g) => g.grade === grade) ?? GRADES[0];
  return (
    <View style={styles.panel}>
      <View style={[styles.given, { backgroundColor: bg }]}>
        <Icon name="task_alt" size="md" color={ink} />
      </View>
      <View accessible accessibilityLiveRegion="polite" style={styles.panelText}>
        <Txt weight={700} numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="label" weight={500} color="onSurfaceVariant" numberOfLines={2}>
          {text}
        </Txt>
      </View>
      <Button variant="tonal" icon="undo" label={undo.label} accessibilityLabel={undo.accessibilityLabel} onPress={undo.onPress} style={styles.undo} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { minHeight: TARGET + GRADE_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  given: { width: GRADE_HEIGHT, height: GRADE_HEIGHT, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  panelText: { flex: 1, minWidth: 0, gap: 2 },
  line: { minHeight: TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  said: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  undo: { paddingHorizontal: 10, flexShrink: 0 },
  grades: { flexDirection: 'row', gap: 8 },
  gradesCompact: { gap: 6 },
  grade: { flex: 1, minWidth: 0, minHeight: GRADE_HEIGHT, paddingHorizontal: 6, borderRadius: radius['2xl'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
