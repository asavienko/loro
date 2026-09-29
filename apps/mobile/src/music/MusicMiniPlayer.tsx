// The song that's playing, docked above the tab bar (plan 106): night-coloured, so it never reads as
// the phrase mini-player. Tap to open the song; the button plays or pauses.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCopy } from '../state/store';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow, TARGET } from '../ui/theme';
import { AlbumCover } from './AlbumCover';
import { useMusic } from './MusicPlayer';

export function MusicMiniPlayer() {
  const c = useCopy();
  const router = useRouter();
  const music = useMusic();
  if (!music.song) return null;
  const share = music.duration > 0 ? Math.min(1, music.position / music.duration) : 0;
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${c.music.nowPlaying}: ${music.song.title}`}
        onPress={() => router.push('/song')}
        style={styles.main}
      >
        <AlbumCover url={music.album?.coverUrl ?? null} px={40} rounded={8} />
        <View style={styles.text}>
          <Txt variant="body" weight={700} color="onNight" numberOfLines={1}>
            {music.song.title}
          </Txt>
          <Txt variant="label" color="onNightVariant" numberOfLines={1}>
            {music.song.audioBy === 'demo' ? `${music.album?.title ?? ''} · ${c.music.demoSound}` : (music.album?.title ?? '')}
          </Txt>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={music.playing ? c.common.pause : c.common.play} onPress={music.toggle} style={styles.play}>
        <Icon name={music.playing ? 'pause' : 'play_arrow'} fill size="xl" color="onNight" />
      </Pressable>
      <View style={styles.track} accessible={false}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.night, borderRadius: radius.xl, paddingLeft: 8, overflow: 'hidden', ...shadow.float },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  text: { flex: 1, gap: 1 },
  play: { width: TARGET + 8, height: TARGET + 12, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.nightOutline },
  fill: { height: 2, backgroundColor: colors.nightAccent },
});
