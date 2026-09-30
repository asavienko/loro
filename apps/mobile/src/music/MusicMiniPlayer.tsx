// A song in the one player's bar (plan 107): the same bar as a phrase's, told apart by the song's
// cover and a music-note badge. Tap to open the player; the button plays or pauses.
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
  const kind = music.song.audioBy === 'demo' ? (music.song.voiced ? c.music.spokenDemo : c.music.demoSound) : c.music.sung;
  return (
    <View style={styles.player}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${c.music.nowPlaying}: ${music.song.title}`}
          accessibilityHint={c.music.songKind}
          onPress={() => router.push('/player')}
          style={styles.open}
        >
          <View>
            <AlbumCover url={music.album?.coverUrl ?? null} px={44} rounded={8} />
            <View style={styles.badge}>
              <Icon name="music_note" size={14} color="onPrimaryFixed" />
            </View>
          </View>
          <View style={styles.text}>
            <Txt variant="row" weight={600} color="inverseOnSurface" numberOfLines={1}>
              {music.song.title}
            </Txt>
            <Txt variant="label" color="secondaryFixedDim" numberOfLines={1}>
              {music.playing ? `${c.music.songKind} · ${kind}` : c.player.paused}
            </Txt>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={music.playing ? c.common.pause : c.common.play}
          onPress={music.toggle}
          style={({ pressed }) => [styles.play, pressed && { opacity: 0.8 }]}
        >
          <Icon name={music.playing ? 'pause' : 'play_arrow'} fill size="lg" color="onPrimaryFixed" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.music.next}
          disabled={music.index + 1 >= music.queue.length}
          onPress={music.next}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }, music.index + 1 >= music.queue.length && { opacity: 0.4 }]}
        >
          <Icon name="skip_next" fill size="lg" color="inverseOnSurface" />
        </Pressable>
      </View>
      <View style={styles.track} accessible={false}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

// The phrase bar's own measures (src/ui/MiniPlayer.tsx), so the two read as one player.
const styles = StyleSheet.create({
  player: { borderRadius: radius['2xl'], backgroundColor: colors.inverseSurface, overflow: 'hidden', ...shadow.float },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  open: { flex: 1, minWidth: 0, minHeight: TARGET, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.inverseSurface },
  text: { flex: 1, minWidth: 0 },
  play: { width: TARGET, height: TARGET, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  next: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(243,240,235,0.2)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primaryFixed, borderRadius: radius.full },
});
