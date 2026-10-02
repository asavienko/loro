// How a song is sung besides its style (plan 113): voice, tempo, mood and length, folded under one
// row that says what is chosen, so the defaults make a song without a look and every choice is one
// tap away. The tempo and length say what they mean under their chips; on a server with only the
// demo sound, it says that voice, tempo and mood are heard once songs are sung.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SONG_LENGTH_LINES, SONG_LENGTHS, SONG_MOODS, SONG_TEMPOS, SONG_VOICES, type SongOptions } from '@shared/api/library';
import type { Copy } from '@shared/copy/en';
import { Chip } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

/** The options in a few words: the voice, tempo, the mood when one was chosen, and the length. */
export function optionsSummary(c: Copy, options: SongOptions): string {
  return [c.music.voice[options.voice], c.music.tempo[options.tempo], ...(options.mood ? [c.music.mood[options.mood]] : []), c.music.length[options.length]].join(' · ');
}

export function SongOptionsPanel({ c, options, onChange, demoSound }: { c: Copy; options: SongOptions; onChange: (options: SongOptions) => void; demoSound: boolean }) {
  const [open, setOpen] = useState(false);
  const set = (change: Partial<SongOptions>) => onChange({ ...options, ...change });
  const summary = optionsSummary(c, options);
  return (
    <View style={styles.panel}>
      <Press
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={`${c.create.songOptions}: ${summary}`}
        onPress={() => setOpen((was) => !was)}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <Icon name="graphic_eq" color="primaryContainer" />
        <View style={styles.headText}>
          <Txt variant="row" weight={600}>
            {c.create.songOptions}
          </Txt>
          <Txt variant="label" color="secondary" numberOfLines={2}>
            {summary}
          </Txt>
        </View>
        <View style={open && styles.flipped}>
          <Icon name="keyboard_arrow_down" color="secondary" />
        </View>
      </Press>
      {open && (
        <View style={styles.body}>
          <Group label={c.create.pickVoice}>
            {SONG_VOICES.map((id) => (
              <Chip key={id} label={c.music.voice[id]} selected={options.voice === id} onPress={() => set({ voice: id })} />
            ))}
          </Group>
          <Group label={c.create.pickTempo} note={c.create.tempoNote[options.tempo]}>
            {SONG_TEMPOS.map((id) => (
              <Chip key={id} label={c.music.tempo[id]} selected={options.tempo === id} onPress={() => set({ tempo: id })} />
            ))}
          </Group>
          <Group label={c.create.pickMood}>
            <Chip label={c.create.moodAny} selected={options.mood === null} onPress={() => set({ mood: null })} />
            {SONG_MOODS.map((id) => (
              <Chip key={id} label={c.music.mood[id]} selected={options.mood === id} onPress={() => set({ mood: id })} />
            ))}
          </Group>
          <Group label={c.create.pickLength} note={c.create.lengthNote(SONG_LENGTH_LINES[options.length])}>
            {SONG_LENGTHS.map((id) => (
              <Chip key={id} label={c.music.length[id]} selected={options.length === id} onPress={() => set({ length: id })} />
            ))}
          </Group>
          {demoSound && (
            <View style={styles.demo}>
              <Icon name="info" size="xs" color="secondary" />
              <Txt variant="label" color="secondary" style={{ flex: 1 }}>
                {c.create.optionsDemo}
              </Txt>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Group({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Txt variant="label" weight={700} color="secondary">
        {label}
      </Txt>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {children}
      </View>
      {note && (
        <Txt variant="label" color="secondary" accessibilityLiveRegion="polite">
          {note}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 16, marginTop: 16, borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  headText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.8 },
  flipped: { transform: [{ rotate: '180deg' }] },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 14, borderTopWidth: 1, borderTopColor: colors.hairline },
  group: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  demo: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
});
