// The songs the learner hearted in the player (plan 107), at the top of Library's albums: a tap plays
// one in the one player, with its album. Songs are the server's, so they are fetched to be shown; one
// that has gone (removed, or made private) is left out.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { unreachable } from '@shared/api/client';
import { fetchAlbum, fetchSong, type Song } from '@shared/api/library';
import { findSet } from '@shared/content';
import { likedSongIds } from '@shared/state/selectors';
import { useCopy, useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { useToast } from '../ui/Toast';
import { problemText } from '../ui/problems';
import { colors, radius, TARGET } from '../ui/theme';
import { clockTime, useMusic } from './MusicPlayer';

/** Songs fetched once, kept for when the next fetch can't reach the server. */
const seen = new Map<string, Song>();

export function LikedSongs() {
  const c = useCopy();
  const { state } = useStore();
  const music = useMusic();
  const { toast } = useToast();
  const ids = likedSongIds(state.learner);
  const key = ids.join(',');
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    let live = true;
    const wanted = key ? key.split(',') : [];
    void Promise.all(
      wanted.map((id) =>
        fetchSong(id).then(
          (song) => {
            seen.set(id, song);
            return song;
          },
          // Offline: the copy from before. Gone: nothing.
          (error: unknown) => (unreachable(error) ? (seen.get(id) ?? null) : null),
        ),
      ),
    ).then((found) => {
      if (live) setSongs(found.filter((s): s is Song => s !== null && s.status === 'ready'));
    });
    return () => {
      live = false;
    };
  }, [key]);

  const target = state.learner.profile.targetLang;
  // This course's songs (a song whose set this device doesn't know is kept rather than guessed away).
  // Only what is liked now: an unliked song leaves before the next fetch returns.
  const shown = (songs ?? []).filter((s) => {
    const set = findSet(s.setId);
    return ids.includes(s.id) && (!set || set.targetLang === target);
  });
  if (ids.length === 0 || shown.length === 0) return null;

  const play = (song: Song) => {
    if (music.song?.id === song.id) return music.toggle();
    fetchAlbum(song.albumId).then(
      (detail) => music.playAlbum(detail.album, [song], 0),
      (error: unknown) => toast(problemText(c, error)),
    );
  };

  return (
    <View style={styles.shelf}>
      <View style={styles.head}>
        <Icon name="favorite" fill color="primaryContainer" />
        <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
          {c.music.likedSongs}
        </Txt>
      </View>
      {shown.map((song) => {
        const playing = music.song?.id === song.id && music.playing;
        return (
          <Pressable
            key={song.id}
            accessibilityRole="button"
            accessibilityLabel={playing ? c.common.pause : c.music.playSong(song.title)}
            onPress={() => play(song)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Icon name="music_note" color="onPrimaryFixed" />
            </View>
            <View style={styles.text}>
              <Txt variant="row" weight={600} numberOfLines={1}>
                {song.title}
              </Txt>
              <Txt variant="label" color="secondary" numberOfLines={1}>
                {[c.music.songKind, c.music.style[song.styleId], song.durationMs ? clockTime(song.durationMs / 1000) : null].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            <Icon name={playing ? 'pause' : 'play_arrow'} fill color="primaryContainer" />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TARGET + 8, borderRadius: radius.xl },
  icon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  pressed: { opacity: 0.8 },
});
