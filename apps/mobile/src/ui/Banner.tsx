import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { radius } from './theme';

/**
 * A few words and the one action they lead to (sign in, say). The action sits beside the words, and
 * goes under them when they need the width, so a narrow screen never squeezes them into a column.
 */
export function Banner({ icon, children, action, style }: { icon?: IconName; children: ReactNode; action: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.banner, style]}>
      <View style={styles.words}>
        {icon && <Icon name={icon} size="2xl" color="primaryContainer" />}
        <View style={styles.flex}>{children}</View>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: 16, borderRadius: radius['2xl'] },
  words: { flexGrow: 1, flexShrink: 1, flexBasis: 200, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
});
