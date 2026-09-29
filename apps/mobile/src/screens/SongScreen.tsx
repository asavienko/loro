// The song playing (plan 106): cover, where it is, the controls, and the lyrics, each line with its
// meaning a tap away. Where the sound's timing is known (the demo sound) the line being played lights
// up. A demo sound says so: it is the server's instrumental, never passed off as a sung recording.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { findSet } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCover } from '../music/AlbumCover';
import { clockTime, useMusic } from '../music/MusicPlayer';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function SongScreen() {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const music = useMusic();
  const [meanings, setMeanings] = useState(true);
  const [barWidth, setBarWidth] = useState(0);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/music'));
  const song = music.song;

  if (!song) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <Txt variant="row" color="onNightVariant">
          {c.music.noSongs}
        </Txt>
        <Button variant="text" color="nightAccent" label={c.common.close} onPress={close} />
      </View>
    );
  }

  const ms = music.position * 1000;
  const share = music.duration > 0 ? Math.min(1, music.position / music.duration) : 0;
  const set = findSet(song.setId);
  const lines = song.sections.flatMap((section) => section.lines);
  const active = lines.findIndex((line) => line.startMs !== null && line.endMs !== null && ms >= line.startMs && ms < line.endMs);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Button variant="icon" icon="keyboard_arrow_down" color="onNight" accessibilityLabel={c.common.close} onPress={close} />
        <Txt variant="label" weight={700} color="onNightVariant" style={styles.topTitle} numberOfLines={1}>
          {music.album?.title ?? c.music.nowPlaying}
        </Txt>
        <View style={{ width: TARGET }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.cover}>
          <AlbumCover url={music.album?.coverUrl ?? null} px={240} rounded={16} />
        </View>
        <Txt variant="displaySm" face="serif" weight={600} color="onNight" accessibilityRole="header">
          {song.title}
        </Txt>
        <View style={styles.badges}>
          <Badge icon={song.audioBy === 'demo' ? 'graphic_eq' : 'mic'} label={song.audioBy === 'demo' ? c.music.demoSound : c.music.sung} />
          <Badge icon="lyrics" label={c.music.lyricsBy[song.lyricsBy]} />
          <Badge icon="equalizer" label={c.music.style[song.styleId]} />
        </View>
        {song.audioBy === 'demo' && (
          <Txt variant="label" color="onNightVariant">
            {c.music.demoNote}
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
          <Txt variant="label" color="onNightVariant">
            {clockTime(music.position)}
          </Txt>
          <Txt variant="label" color="onNightVariant">
            {clockTime(music.duration)}
          </Txt>
        </View>

        <View style={styles.controls}>
          <Button variant="icon" icon="skip_previous" color="onNight" accessibilityLabel={c.music.previous} onPress={music.previous} />
          <Pressable accessibilityRole="button" accessibilityLabel={music.playing ? c.common.pause : c.common.play} onPress={music.toggle} style={styles.play}>
            <Icon name={music.playing ? 'pause' : 'play_arrow'} fill size="2xl" color="night" />
          </Pressable>
          <Button variant="icon" icon="skip_next" color="onNight" accessibilityLabel={c.music.next} disabled={music.index + 1 >= music.queue.length} onPress={music.next} />
        </View>

        <View style={styles.lyricsHead}>
          <Txt variant="heading" face="serif" weight={600} color="onNight" accessibilityRole="header" style={{ flex: 1 }}>
            {c.music.lyrics}
          </Txt>
          <Button variant="text" color="nightAccent" icon="translate" label={meanings ? c.music.hideMeanings : c.music.showMeanings} onPress={() => setMeanings((m) => !m)} />
        </View>
        {song.sections.map((section, s) => {
          const before = song.sections.slice(0, s).reduce((n, x) => n + x.lines.length, 0);
          return (
            <View key={`${section.name}-${s}`} style={styles.section}>
              <Txt variant="label" weight={700} color="nightAccent">
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
                    <Txt variant="title" face="serif" weight={on ? 700 : 500} color={on ? 'nightAccent' : 'onNight'} lang={set?.targetLang}>
                      {line.text}
                    </Txt>
                    {meanings && (
                      <Txt variant="body" color="onNightVariant">
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
    </View>
  );
}

function Badge({ icon, label }: { icon: 'graphic_eq' | 'mic' | 'lyrics' | 'equalizer'; label: string }) {
  return (
    <View style={styles.badge}>
      <Icon name={icon} size="xs" color="nightAccent" />
      <Txt variant="label" weight={600} color="onNight">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.night },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  topTitle: { flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cover: { alignItems: 'center', paddingVertical: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.nightContainer },
  bar: { height: TARGET, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.nightOutline, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.nightAccent },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.nightAccent, alignItems: 'center', justifyContent: 'center' },
  lyricsHead: { flexDirection: 'row', alignItems: 'center', paddingTop: 16 },
  section: { gap: 4, paddingTop: 8 },
  line: { paddingVertical: 6, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: radius.xl },
  lineOn: { backgroundColor: colors.nightContainer },
  setLink: { alignSelf: 'flex-start', marginTop: 16 },
});
