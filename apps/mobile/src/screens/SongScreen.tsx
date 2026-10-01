// A song in the one player (plans 106, 107): cover, where it is, the controls, a heart, and Missed /
// Hard / Easy, which review every phrase the song sings (the same window and undo as a phrase's
// rating). Then the lyrics, each line with its meaning a tap away; where the sound's timing is known
// (the demo sound) the line being played lights up. A demo sound says so: it is the server's
// instrumental, never passed off as a sung recording.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Song } from '@shared/api/library';
import { findSet } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { formatElapsed } from '@shared/state/clock';
import { RATING_WINDOW_MS } from '@shared/state/memory';
import { isLiked, windowLeft } from '@shared/state/selectors';
import type { Grade } from '@shared/state/types';
import { AlbumCover } from '../music/AlbumCover';
import { clockTime, useMusic } from '../music/MusicPlayer';
import { songRating, useRateSong } from '../music/songRating';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PullDownWindow, PullHandle } from '../ui/PullDown';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow, TARGET } from '../ui/theme';
import { GRADES } from '../ui/grades';
import { useRoom } from '../ui/useRoom';

export function SongScreen() {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { compact } = useRoom();
  const music = useMusic();
  const { state, actions } = useStore();
  const [meanings, setMeanings] = useState(true);
  const [barWidth, setBarWidth] = useState(0);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const song = music.song;

  if (!song) {
    return (
      <PullDownWindow onClose={close} style={[styles.page, { paddingTop: insets.top }]}>
        <PullHandle />
        <View style={[styles.flex, styles.center]}>
          <Txt variant="row" color="secondary">
            {c.music.noSongs}
          </Txt>
          <Button variant="text" label={c.common.close} onPress={close} />
        </View>
      </PullDownWindow>
    );
  }

  const ms = music.position * 1000;
  const share = music.duration > 0 ? Math.min(1, music.position / music.duration) : 0;
  const set = findSet(song.setId);
  const lines = song.sections.flatMap((section) => section.lines);
  const active = lines.findIndex((line) => line.startMs !== null && line.endMs !== null && ms >= line.startMs && ms < line.endMs);
  const liked = isLiked(state.learner, 'song', song.id);

  return (
    <PullDownWindow onClose={close} style={[styles.page, { paddingTop: insets.top }]}>
      <PullHandle>
        <View style={styles.top}>
          <Button variant="icon" icon="keyboard_arrow_down" accessibilityLabel={c.common.close} onPress={close} />
          <View style={styles.topText}>
            <View style={styles.kind}>
              <Icon name="music_note" size="xs" color="primaryContainer" />
              <Txt variant="label" weight={700} color="primaryContainer">
                {c.music.songKind}
              </Txt>
            </View>
            <Txt variant="label" color="secondary" numberOfLines={1} align="center">
              {music.album?.title ?? c.music.nowPlaying}
            </Txt>
          </View>
          <View style={{ width: TARGET }} />
        </View>
      </PullHandle>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.cover}>
          <AlbumCover url={music.album?.coverUrl ?? null} px={220} rounded={20} />
        </View>
        <View style={styles.titleRow}>
          <Txt variant="displaySm" face="serif" weight={600} accessibilityRole="header" style={{ flex: 1 }}>
            {song.title}
          </Txt>
          <Pressable
            accessibilityRole="togglebutton"
            accessibilityLabel={c.music.likeSong}
            accessibilityState={{ checked: liked }}
            onPress={() => actions.toggleLike('song', song.id)}
            style={styles.heart}
          >
            <Icon name="favorite" fill={liked} size={26} color={liked ? 'primaryContainer' : 'secondary'} />
          </Pressable>
        </View>
        <View style={styles.badges}>
          <Badge icon={song.audioBy === 'demo' && !song.voiced ? 'graphic_eq' : 'mic'} label={song.audioBy === 'demo' ? (song.voiced ? c.music.spokenDemo : c.music.demoSound) : c.music.sung} />
          <Badge icon="lyrics" label={c.music.lyricsBy[song.lyricsBy]} />
          <Badge icon="equalizer" label={c.music.style[song.styleId]} />
        </View>
        {song.audioBy === 'demo' && (
          <Txt variant="label" color="secondary">
            {song.voiced ? c.music.spokenNote : c.music.demoNote}
          </Txt>
        )}

        {/* Where the song is: tap the bar to move there. */}
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={`${clockTime(music.position)} / ${clockTime(music.duration)}`}
          onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={(e) => barWidth > 0 && music.seek((e.nativeEvent.locationX / barWidth) * music.duration)}
          style={styles.bar}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
          </View>
        </Pressable>
        <View style={styles.times}>
          <Txt variant="label" color="secondary">
            {clockTime(music.position)}
          </Txt>
          <Txt variant="label" color="secondary">
            {clockTime(music.duration)}
          </Txt>
        </View>

        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel={c.music.previous} onPress={music.previous} style={styles.skip}>
            <Icon name="skip_previous" fill size={34} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={music.playing ? c.common.pause : c.common.play}
            onPress={music.toggle}
            style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <Icon name={music.playing ? 'pause' : 'play_arrow'} fill size={40} color="onPrimary" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.music.next}
            disabled={music.index + 1 >= music.queue.length}
            onPress={music.next}
            style={[styles.skip, music.index + 1 >= music.queue.length && { opacity: 0.35 }]}
          >
            <Icon name="skip_next" fill size={34} />
          </Pressable>
        </View>

        <SongRating song={song} />

        <View style={styles.lyricsHead}>
          <Txt variant="heading" face="serif" weight={600} accessibilityRole="header" style={{ flex: 1 }}>
            {c.music.lyrics}
          </Txt>
          <Button variant="text" icon="translate" label={meanings ? c.music.hideMeanings : c.music.showMeanings} onPress={() => setMeanings((m) => !m)} />
        </View>
        {song.sections.map((section, s) => {
          const before = song.sections.slice(0, s).reduce((n, x) => n + x.lines.length, 0);
          return (
            <View key={`${section.name}-${s}`} style={styles.section}>
              <Txt variant="label" weight={700} color="primaryContainer">
                {c.music.section[section.name].toLocaleUpperCase(c.locale)}
              </Txt>
              {section.lines.map((line, l) => {
                const at = before + l;
                const on = at === active;
                return (
                  <Pressable
                    key={at}
                    accessibilityRole={line.startMs !== null ? 'button' : 'text'}
                    disabled={line.startMs === null}
                    onPress={() => line.startMs !== null && music.seek(line.startMs / 1000)}
                    style={[styles.line, on && styles.lineOn]}
                  >
                    <Txt variant="title" face="serif" weight={on ? 700 : 500} color={on ? 'primaryContainer' : 'onSurface'} lang={set?.targetLang}>
                      {line.text}
                    </Txt>
                    {meanings && (
                      <Txt variant="body" color="secondary">
                        {line.meaning}
                      </Txt>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {set && <Button variant="tonal" icon="menu_book" label={c.music.fromSet(set.title)} onPress={() => nav.openSet(set.id)} style={styles.setLink} />}
      </ScrollView>
    </PullDownWindow>
  );
}

/**
 * Missed / Hard / Easy for a song: each reviews every phrase of this learner's course that the song
 * sings and that has no rating of its own waiting, with the same five-minute window and undo as a
 * phrase's rating. What it says (the grade, how many phrases) is read from the ratings the song gave.
 */
function SongRating({ song }: { song: Song }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const now = useNow(1000);
  const rateSong = useRateSong();
  const rating = songRating(state, song, now);
  const { given, ratable, count } = rating;
  const rated = given[0];
  const left = given.length > 0 ? Math.min(RATING_WINDOW_MS, ...given.map((p) => windowLeft(p, Math.max(now, p.at)))) : 0;
  const rate = (grade: Grade) => rateSong(song, rating, grade);
  const { compact } = useRoom();
  if (count === 0) return null;
  return (
    <View style={styles.rating}>
      <View style={styles.ratingLine}>
        {rated ? (
          <>
            <Txt style={{ flex: 1 }}>{c.music.songRated(c.common.grade[rated.grade], given.length)}</Txt>
            <Button variant="text" label={c.player.undoFor(formatElapsed(left))} accessibilityLabel={c.player.undoLabel(formatElapsed(left))} onPress={() => actions.unratePhrases(song.id)} />
          </>
        ) : (
          <Txt color="secondary" align="center" style={{ flex: 1 }}>
            {c.music.rateSong(ratable.length)}
          </Txt>
        )}
      </View>
      <View style={styles.grades}>
        {GRADES.map(({ grade, icon, bg, ink }) => {
          const selected = rated?.grade === grade;
          return (
            <Pressable
              key={grade}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => rate(grade)}
              style={({ pressed }) => [styles.grade, { backgroundColor: bg }, selected && styles.gradeSelected, pressed && { opacity: 0.8 }]}
            >
              {/* As in the phrase player: a compact screen keeps the words whole and lets the colours tell the grades apart. */}
              {(!compact || selected) && <Icon name={selected ? 'task_alt' : icon} size="sm" color={ink} />}
              <Txt weight={selected ? 700 : 600} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
                {c.common.grade[grade]}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Badge({ icon, label }: { icon: 'graphic_eq' | 'mic' | 'lyrics' | 'equalizer'; label: string }) {
  return (
    <View style={styles.badge}>
      <Icon name={icon} size="xs" color="primaryContainer" />
      <Txt variant="label" weight={600}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 52, width: '100%', maxWidth: 560, alignSelf: 'center' },
  topText: { flex: 1, alignItems: 'center' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  content: { paddingHorizontal: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  compactContent: { paddingHorizontal: 16 },
  cover: { alignItems: 'center', paddingVertical: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heart: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainer },
  bar: { height: TARGET, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primaryContainer },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  skip: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...shadow.float },
  rating: { gap: 6, paddingTop: 8 },
  ratingLine: { minHeight: TARGET, flexDirection: 'row', alignItems: 'center', gap: 8 },
  grades: { flexDirection: 'row', gap: 8 },
  grade: { flex: 1, minHeight: 52, paddingHorizontal: 4, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  shrink: { flexShrink: 1 },
  gradeSelected: { borderWidth: 2, borderColor: colors.onSurface },
  lyricsHead: { flexDirection: 'row', alignItems: 'center', paddingTop: 16 },
  section: { gap: 4, paddingTop: 8 },
  line: { paddingVertical: 6, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: radius.xl },
  lineOn: { backgroundColor: colors.primaryFixed },
  setLink: { alignSelf: 'flex-start', marginTop: 16 },
});
