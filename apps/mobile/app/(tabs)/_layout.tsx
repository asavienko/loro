// The five tabs (plan 106: Phrases and Music apart, and Create), with the set and album pages inside
// them so the tab bar and mini-players stay under them. The phrase mini-player docks above the tab
// bar whenever something is queued; the song mini-player, in Music's night colours, while a song is
// loaded.
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { currentPhraseId } from '@shared/state/selectors';
import { hrefOf, useShell } from '../../src/nav/Shell';
import { useStore } from '../../src/state/store';
import { MusicMiniPlayer } from '../../src/music/MusicMiniPlayer';
import { useMusic } from '../../src/music/MusicPlayer';
import { MiniPlayer } from '../../src/ui/MiniPlayer';
import { TabBar } from '../../src/ui/TabBar';
import { colors } from '../../src/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }} tabBar={() => <BottomChrome />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="music" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="set/[id]" options={{ href: null }} />
      <Tabs.Screen name="album/[id]" options={{ href: null }} />
    </Tabs>
  );
}

function BottomChrome() {
  const router = useRouter();
  const { tab } = useShell();
  const { state } = useStore();
  const queued = currentPhraseId(state.player) !== null;
  const music = useMusic();
  return (
    <View style={styles.chrome}>
      {music.song && (
        <View style={styles.mini}>
          <MusicMiniPlayer />
        </View>
      )}
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
