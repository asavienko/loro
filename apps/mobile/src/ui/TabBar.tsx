import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Copy } from '@shared/copy';
import type { Tab } from '@shared/nav/routes';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';
import { colors } from './theme';

/** Four tabs (plan 107): songs live in their sets and play in the one player; albums are in Library. */
const TABS: { id: Tab; icon: IconName; label: keyof Copy['tabs'] }[] = [
  { id: 'home', icon: 'home', label: 'home' },
  { id: 'explore', icon: 'explore', label: 'explore' },
  { id: 'create', icon: 'auto_awesome', label: 'create' },
  { id: 'library', icon: 'library_music', label: 'library' },
];

/** The tab bar (the web's src/ui/BottomNavBar.tsx), above the home indicator. */
export function TabBar({ current, onNavigate }: { current: Tab; onNavigate: (tab: Tab) => void }) {
  const c = useCopy();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" aria-label={c.nav.main} style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onNavigate(tab.id)}
              style={({ pressed }) => [styles.tab, pressed && { backgroundColor: colors.surfaceContainer }]}
            >
              <Icon name={tab.icon} fill={active} size="lg" color={active ? 'primaryContainer' : 'secondary'} />
              <Txt variant="caption" weight={active ? 700 : 500} color={active ? 'primaryContainer' : 'secondary'}>
                {c.tabs[tab.label]}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainerHigh },
  row: { height: 56, flexDirection: 'row', width: '100%', maxWidth: 1024, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
