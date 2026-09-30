import { Pressable, StyleSheet, View } from 'react-native';
import { findSet } from '@shared/content';
import type { SetView } from '@shared/state/catalog';
import type { SetProgress } from '@shared/state/selectors';
import { useCopy } from '../state/store';
import { Icon } from './Icon';
import { SetCover } from './SetCover';
import { Txt } from './Txt';
import { colors, ColorName, radius, shadow, TARGET } from './theme';

const BADGE: Record<SetProgress['status'], { bg: string; ink: ColorName }> = {
  new: { bg: colors.primaryFixed, ink: 'onPrimaryFixed' },
  'in-progress': { bg: colors.secondaryContainer, ink: 'onSurface' },
  learned: { bg: colors.tertiaryFixed, ink: 'onTertiaryFixed' },
};

/** A set tile (the web's src/ui/SetCard.tsx): cover, title, status and count, quick-play on the cover. */
export function SetCard({ view, progress, onOpen, onPlay, width = 160 }: { view: SetView; progress: SetProgress; onOpen: () => void; onPlay: () => void; width?: number }) {
  const c = useCopy();
  // Songs sung from it (plan 107), counted by the server; a set of this device has none.
  const songs = findSet(view.id)?.songCount ?? 0;
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <SetCover set={view} px={width} rounded={radius['2xl']} style={shadow.cover} />
        <View style={styles.titleRow}>
          <Txt variant="row" face="serif" weight={600} numberOfLines={2} lang={view.targetLang} style={styles.title}>
            {view.title}
          </Txt>
          {view.level && (
            <Txt variant="caption" weight={700} color="secondary">
              {view.level}
            </Txt>
          )}
        </View>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: BADGE[progress.status].bg }]}>
            <Txt variant="caption" weight={700} color={BADGE[progress.status].ink}>
              {c.status.set[progress.status]}
            </Txt>
          </View>
          <Txt variant="label" color="secondary">
            {songs > 0 ? `${c.common.phrases(progress.total)} · ${c.music.songs(songs)}` : c.common.phrases(progress.total)}
          </Txt>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={c.explore.quickPlay(view.title)}
        onPress={onPlay}
        style={({ pressed }) => [styles.play, { top: width - 52 }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name="play_arrow" fill size="lg" color="primaryContainer" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  title: { flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.lg },
  play: {
    position: 'absolute',
    right: 8,
    width: TARGET,
    height: TARGET,
    borderRadius: radius.full,
    backgroundColor: 'rgba(252,249,244,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});
