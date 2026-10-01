import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SetView } from '@shared/state/catalog';
import { Icon } from './Icon';
import { Press } from './Press';
import { SetCover } from './SetCover';
import { Txt } from './Txt';
import { colors, radius } from './theme';

/** A set as a flat list row (the web's src/ui/SetRow.tsx): cover, serif title, meta. */
export function SetRow({
  set,
  meta,
  onOpen,
  disabled = false,
  action,
}: {
  set: Pick<SetView, 'title' | 'topicId' | 'coverIcon'> & Partial<Pick<SetView, 'id' | 'targetLang'>>;
  meta: string;
  onOpen: () => void;
  disabled?: boolean;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Press accessibilityRole="button" onPress={onOpen} disabled={disabled} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <SetCover set={set} px={56} rounded={12} />
        <View style={styles.text}>
          <Txt variant="row" face="serif" weight={600} numberOfLines={1} lang={set.targetLang}>
            {set.title}
          </Txt>
          <Txt variant="label" color="secondary">
            {meta}
          </Txt>
        </View>
        {!action && !disabled && <Icon name="chevron_right" color="secondary" />}
      </Press>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  main: { flex: 1, minHeight: 64, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius['2xl'] },
  pressed: { backgroundColor: colors.surfaceContainer },
  text: { flex: 1, minWidth: 0 },
  action: { paddingRight: 8 },
});
