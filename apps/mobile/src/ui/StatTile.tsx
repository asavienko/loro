import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';
import { colors, radius, TARGET } from './theme';

/** One figure on a tonal card (the web's src/ui/StatTile.tsx): label, a serif value, a note. */
export function StatTile({ label, value, note, onPress, layout = 'vertical' }: { label: string; value: string; note?: string; onPress?: () => void; layout?: 'vertical' | 'horizontal' }) {
  const horizontal = layout === 'horizontal';
  const body = horizontal ? (
    <View style={styles.horizontal}>
      <Txt variant="displaySm" face="serif" weight={600}>
        {value}
      </Txt>
      <View style={styles.words}>
        <Txt variant="label" weight={600} color="secondary">
          {label}
        </Txt>
        {note && (
          <Txt variant="caption" color="onSurfaceVariant">
            {note}
          </Txt>
        )}
      </View>
    </View>
  ) : (
    <>
      <Txt variant="label" weight={600} color="secondary">
        {label}
      </Txt>
      <Txt variant="displaySm" face="serif" weight={600}>
        {value}
      </Txt>
      {note && (
        <Txt variant="caption" color="onSurfaceVariant">
          {note}
        </Txt>
      )}
    </>
  );
  // Named label first, so a reader hears "Learned, 3".
  const name = [label, value, note].filter(Boolean).join(', ');
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfaceContainer }]}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={name} style={styles.tile}>
      {body}
    </View>
  );
}

/** A figure as a quiet chip, label then value ("Learned 3"). */
export function StatChip({ label, value, icon, onPress }: { label: string; value: string | number; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.surfaceContainer }]}>
      {icon && <Icon name={icon} size="sm" color="primaryContainer" />}
      <Txt variant="body" weight={500}>
        {label}
      </Txt>
      <Txt variant="body" weight={700}>
        {String(value)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, padding: 12, gap: 2 },
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  words: { flex: 1, minWidth: 0 },
  chip: { minHeight: TARGET, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
