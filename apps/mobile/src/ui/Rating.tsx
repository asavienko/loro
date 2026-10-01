// Rating in the players (plan 107), a phrase's and a song's alike: Missed / Hard / Easy, never
// preselected and without times, since FSRS sets when a phrase comes back. Over the grades, one line:
// what to do, or once a grade is given, what it did and Undo; the grade given stays marked below.
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Grade } from '@shared/state/types';
import { useCopy } from '../state/store';
import { Button } from './Button';
import { GRADES } from './grades';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { radius, TARGET, colors } from './theme';
import { useRoom } from './useRoom';

/** The three grades, the one given marked. */
export function GradeRow({ selected, onRate }: { selected: Grade | null; onRate: (grade: Grade) => void }) {
  const c = useCopy();
  const { compact } = useRoom();
  return (
    <View style={[styles.grades, compact && styles.gradesCompact]}>
      {GRADES.map(({ grade, icon, bg, ink }) => {
        const on = selected === grade;
        return (
          <Pressable
            key={grade}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onRate(grade)}
            style={({ pressed }) => [styles.grade, { backgroundColor: bg }, on && styles.gradeSelected, pressed && { opacity: 0.8 }]}
          >
            {/* A compact screen keeps the words whole and lets the colours tell the grades apart. */}
            {(!compact || on) && <Icon name={on ? 'task_alt' : icon} size="sm" color={ink} />}
            <Txt weight={on ? 700 : 600} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
              {c.common.grade[grade]}
            </Txt>
          </Pressable>
        );
      })}
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

const styles = StyleSheet.create({
  line: { minHeight: TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  said: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  undo: { paddingHorizontal: 10, flexShrink: 0 },
  grades: { flexDirection: 'row', gap: 8 },
  gradesCompact: { gap: 6 },
  grade: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 6, borderRadius: radius['2xl'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  gradeSelected: { borderWidth: 2, borderColor: colors.onSurface },
  shrink: { flexShrink: 1 },
});
