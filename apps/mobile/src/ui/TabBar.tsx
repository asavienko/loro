import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tab } from '@shared/nav/routes';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';
import { colors } from './theme';

const TABS: { id: Tab; icon: IconName }[] = [
  { id: 'home', icon: 'home' },
  { id: 'explore', icon: 'search' },
  { id: 'library', icon: 'library_music' },
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
                {c.nav[tab.id]}
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
