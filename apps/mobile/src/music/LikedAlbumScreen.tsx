// Every learner's "Liked songs" album (plan 107), as an album's page: the songs they hearted, most
// recently liked first, played in order in the one player. A heart beside each takes it out; nothing
// else is the owner's to do here (it is made of likes, not shared, renamed or drawn).
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Song } from '@shared/api/library';
import { AlbumSongRow } from '../screens/AlbumScreen';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Txt } from '../ui/Txt';
import { colors } from '../ui/theme';
import { AlbumCover } from './AlbumCover';
import { likedAlbum, useLikedSongs } from './LikedSongs';
import { clockTime, useMusic } from './MusicPlayer';

export function LikedAlbumScreen() {
  const c = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const music = useMusic();
  const { state, actions } = useStore();
  const liked = useLikedSongs();
  const songs = liked.songs;
  const album = likedAlbum(c, state.learner.profile.targetLang, liked);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/library', params: { view: 'albums' } }));
  const isPlaying = (song: Song) => music.song?.id === song.id && music.playing;
  const length = album.durationMs ? ` · ${clockTime(album.durationMs / 1000)}` : '';

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Button variant="icon" icon="arrow_back" color="onSurface" accessibilityLabel={c.common.back} onPress={back} />
      </View>
      <View style={styles.hero}>
        <AlbumCover url={null} px={200} rounded={16} liked />
        <Txt variant="label" weight={700} color="primaryContainer" style={styles.kicker}>
          {c.music.album.toLocaleUpperCase(c.locale)}
        </Txt>
        <Txt variant="displaySm" face="serif" weight={600} color="onSurface" align="center" accessibilityRole="header">
          {album.title}
        </Txt>
        <Txt variant="body" color="secondary" align="center">
          {album.counting ? c.share.yours : `${c.share.yours} · ${c.music.songs(album.songCount)}${length}`}
        </Txt>
      </View>

      <View style={styles.actions}>
        <Button variant="primary" icon="play_arrow" iconFill label={c.music.playAlbum} disabled={!songs || songs.length === 0} onPress={() => songs && music.playAlbum(album, songs, 0)} />
      </View>

      <View style={styles.songs}>
        {songs === null || (songs.length === 0 && !liked.settled) ? (
          <ActivityIndicator color={colors.primaryContainer} style={styles.pad} />
        ) : songs.length === 0 ? (
          <Txt variant="body" color="secondary" style={styles.pad}>
            {liked.partial ? c.account.errors.offline : c.music.likedEmpty}
          </Txt>
        ) : (
          songs.map((song, index) => (
            <AlbumSongRow
              key={song.id}
              song={song}
              index={index}
              current={music.song?.id === song.id}
              playing={isPlaying(song)}
              onPlay={() => {
                if (music.song?.id === song.id) return router.push('/song');
                music.playAlbum(album, songs, index);
              }}
              after={
                <Button
                  variant="icon"
                  icon="favorite"
                  iconFill
                  color="primaryContainer"
                  accessibilityRole="togglebutton"
                  accessibilityState={{ checked: true }}
                  accessibilityLabel={c.music.likeSong}
                  onPress={() => actions.toggleLike('song', song.id)}
                />
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  top: { flexDirection: 'row', paddingHorizontal: 8 },
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  kicker: { marginTop: 12, letterSpacing: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 16 },
  songs: { paddingTop: 20, gap: 2, paddingHorizontal: 12 },
  pad: { paddingHorizontal: 12, paddingVertical: 8 },
});
