// The three tabs, and the set page inside them so the tab bar and mini-player stay under it (as on
// the web). The mini-player docks above the tab bar whenever something is queued.
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { currentPhraseId } from '@shared/state/selectors';
import { hrefOf, useShell } from '../../src/nav/Shell';
import { useStore } from '../../src/state/store';
import { MiniPlayer } from '../../src/ui/MiniPlayer';
import { TabBar } from '../../src/ui/TabBar';
import { colors } from '../../src/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }} tabBar={() => <BottomChrome />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="set/[id]" options={{ href: null }} />
    </Tabs>
  );
}

function BottomChrome() {
  const router = useRouter();
  const { tab } = useShell();
  const { state } = useStore();
  const queued = currentPhraseId(state.player) !== null;
  return (
    <View style={styles.chrome}>
      {queued && (
        <View style={styles.mini}>
          <MiniPlayer onOpenPlayer={() => router.push('/player')} />
        </View>
      )}
      <TabBar current={tab} onNavigate={(next) => router.navigate(hrefOf({ name: next }) as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { backgroundColor: 'transparent' },
  mini: { paddingHorizontal: 8, paddingBottom: 6, width: '100%', maxWidth: 512, alignSelf: 'center' },
});
