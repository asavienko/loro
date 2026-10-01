// The five tabs (plan 106: Phrases and Music apart, and Create), with the set and album pages inside
// them so the tab bar and mini-players stay under them. The phrase mini-player docks above the tab
// bar whenever something is queued; the song mini-player, in Music's night colours, while a song is
// loaded. The grades of whichever plays float over the page just above it.
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentPhraseId } from '@shared/state/selectors';
import { hrefOf, useShell } from '../../src/nav/Shell';
import { useStore } from '../../src/state/store';
import { MusicMiniPlayer, SongBarGrades } from '../../src/music/MusicMiniPlayer';
import { useMusic } from '../../src/music/MusicPlayer';
import { MiniPlayer, PhraseBarGrades } from '../../src/ui/MiniPlayer';
import { BarPassCard } from '../../src/nav/PassNotice';
import { BarShiftProvider } from '../../src/ui/barShift';
import { TabBar } from '../../src/ui/TabBar';
import { useReportChrome } from '../../src/ui/Toast';
import { colors } from '../../src/ui/theme';

/** Between the bar and the grades over it. */
const OVER_BAR = 10;

export default function TabsLayout() {
  // How tall the tab bar and the bar above it are, and the grades over them, for what sits higher.
  const [chrome, setChrome] = useState<number | null>(null);
  const [grades, setGrades] = useState(0);
  const insets = useSafeAreaInsets();
  const report = useReportChrome();
  useEffect(() => {
    if (chrome !== null) report(chrome - insets.bottom + (grades > 0 ? grades + OVER_BAR : 0));
  }, [chrome, grades, insets.bottom, report]);
  useEffect(() => () => report(null), [report]);
  return (
    <BarShiftProvider>
      <View style={styles.page}>
        <Tabs backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }} tabBar={() => <BottomChrome onHeight={setChrome} />}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="explore" />
          <Tabs.Screen name="music" options={{ href: null }} />
          <Tabs.Screen name="create" />
          <Tabs.Screen name="library" />
          <Tabs.Screen name="set/[id]" options={{ href: null }} />
          <Tabs.Screen name="album/[id]" options={{ href: null }} />
        </Tabs>
        {/* Over the page rather than inside the tab bar: a touch outside a view's bounds doesn't reach it on Android. */}
        {chrome !== null && (
          <View style={[styles.over, { bottom: chrome + OVER_BAR }]} pointerEvents="box-none">
            <View style={styles.grades} pointerEvents="box-none" onLayout={(e) => setGrades(e.nativeEvent.layout.height)}>
              <BarPassCard />
              <FrontGrades />
            </View>
          </View>
        )}
      </View>
    </BarShiftProvider>
  );
}

/** One player (plan 107): its bar shows what was started last, a song or the phrase loop; a song still loaded shows when no phrase is queued. */
function useFront(): 'song' | 'phrases' | null {
  const { state } = useStore();
  const music = useMusic();
  const queued = currentPhraseId(state.player) !== null;
  if (music.song !== null && (music.front || !queued)) return 'song';
  return queued ? 'phrases' : null;
}

function FrontGrades() {
  const front = useFront();
  if (front === 'song') return <SongBarGrades />;
  if (front === 'phrases') return <PhraseBarGrades />;
  return null;
}

function BottomChrome({ onHeight }: { onHeight: (height: number) => void }) {
  const router = useRouter();
  const { tab } = useShell();
  const front = useFront();
  return (
    <View style={styles.chrome} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
      {front === 'song' && (
        <View style={styles.mini}>
          <MusicMiniPlayer />
        </View>
      )}
      {front === 'phrases' && (
        <View style={styles.mini}>
          <MiniPlayer onOpenPlayer={() => router.push('/player')} />
        </View>
      )}
      <TabBar current={tab} onNavigate={(next) => router.navigate(hrefOf({ name: next }) as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  chrome: { backgroundColor: 'transparent' },
  mini: { paddingHorizontal: 8, paddingBottom: 6, width: '100%', maxWidth: 512, alignSelf: 'center' },
  over: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  grades: { width: '100%', maxWidth: 512, paddingHorizontal: 12 },
});
