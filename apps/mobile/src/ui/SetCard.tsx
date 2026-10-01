import { StyleSheet, View } from 'react-native';
import type { SetView } from '@shared/state/catalog';
import type { SetProgress } from '@shared/state/selectors';
import { useCopy } from '../state/store';
import { Icon } from './Icon';
import { Press } from './Press';
import { SetCover } from './SetCover';
import { Txt } from './Txt';
import { colors, ColorName, radius, shadow, TARGET } from './theme';

const BADGE: Record<SetProgress['status'], { bg: string; ink: ColorName }> = {
  new: { bg: colors.primaryFixed, ink: 'onPrimaryFixed' },
  'in-progress': { bg: colors.secondaryContainer, ink: 'onSurface' },
  learned: { bg: colors.tertiaryFixed, ink: 'onTertiaryFixed' },
};

/**
 * A set tile (the web's src/ui/SetCard.tsx): cover, title, then status, level and count on one line;
 * quick-play on the cover. The title has the card's whole width; a set's songs show as the music
 * note on its cover.
 */
export function SetCard({ view, progress, onOpen, onPlay, width = 160 }: { view: SetView; progress: SetProgress; onOpen: () => void; onPlay: () => void; width?: number }) {
  const c = useCopy();
  return (
    <View style={{ width }}>
      <Press accessibilityRole="button" onPress={onOpen} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <SetCover set={view} px={width} rounded={radius['2xl']} style={shadow.cover} />
        <Txt variant="row" face="serif" weight={600} numberOfLines={2} lang={view.targetLang} style={styles.title}>
          {view.title}
        </Txt>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: BADGE[progress.status].bg }]}>
            <Txt variant="caption" weight={700} color={BADGE[progress.status].ink} numberOfLines={1}>
              {c.status.set[progress.status]}
            </Txt>
          </View>
          <Txt variant="label" color="secondary">
            {[view.level, c.common.phrases(progress.total)].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </Press>
      <Press
        accessibilityRole="button"
        accessibilityLabel={c.explore.quickPlay(view.title)}
        onPress={onPlay}
        style={({ pressed }) => [styles.play, { top: width - 52 }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Icon name="play_arrow" fill size="lg" color="primaryContainer" />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2, marginTop: 4 },
  badge: { maxWidth: '100%', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.lg },
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
