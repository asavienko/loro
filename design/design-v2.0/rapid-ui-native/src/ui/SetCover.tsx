// A set's cover, drawn from content (the web prototype's src/ui/SetCover.tsx): the topic's colour,
// a shape chosen per set, and the set's icon. Drawn, never photographed: no text or number on it.
import { StyleSheet, View, ViewStyle } from 'react-native';
import { getTopic, SETS, TopicTone, TOPICS } from '@shared/content';
import type { SetView } from '@shared/state/catalog';
import { Icon, IconName } from './Icon';
import { colors, ColorName } from './theme';

export const TONE: Record<TopicTone, { bg: string; ink: ColorName }> = {
  primary: { bg: colors.primaryFixed, ink: 'onPrimaryFixed' },
  secondary: { bg: colors.secondaryContainer, ink: 'onSurface' },
  tertiary: { bg: colors.tertiaryFixed, ink: 'onTertiaryFixed' },
};

const MOTIF_TONE: Record<TopicTone, string> = {
  primary: colors.primaryFixedDim,
  secondary: colors.secondaryFixedDim,
  tertiary: '#bacda6',
};

const MOTIFS = ['medallion', 'arch', 'horizon'] as const;

// Sets of one topic share a colour, so each takes the next shape; a set of your own picks by its id.
const MOTIF_BY_SET = new Map(
  SETS.map((s) => [s.id, (TOPICS.findIndex((t) => t.id === s.topicId) + SETS.filter((t) => t.topicId === s.topicId).indexOf(s)) % MOTIFS.length]),
);
const motifOf = (id: string | undefined) => (id === undefined ? 0 : (MOTIF_BY_SET.get(id) ?? [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % MOTIFS.length));

export function SetCover({
  set,
  px,
  rounded = 16,
  style,
}: {
  set: Pick<SetView, 'topicId' | 'coverIcon'> & { id?: string };
  /** The square's side; under 96 px the glyph stands alone, larger. */
  px: number;
  rounded?: number;
  style?: ViewStyle;
}) {
  const tone = (set.topicId && getTopic(set.topicId)?.tone) || 'secondary';
  const motif = MOTIFS[motifOf(set.id)];
  const small = px < 96;
  const glyph = Math.round(px * (small ? 0.6 : 0.46));
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[{ width: px, height: px, borderRadius: rounded, backgroundColor: TONE[tone].bg, overflow: 'hidden' }, style]}>
      {!small && motif === 'medallion' && (
        <View style={{ position: 'absolute', width: px * 0.64, height: px * 0.64, left: px * 0.18, top: px * 0.18, borderRadius: px, backgroundColor: MOTIF_TONE[tone] }} />
      )}
      {!small && motif === 'arch' && (
        <View style={{ position: 'absolute', left: px * 0.16, right: px * 0.16, bottom: 0, height: px * 0.74, borderTopLeftRadius: px, borderTopRightRadius: px, backgroundColor: MOTIF_TONE[tone] }} />
      )}
      {!small && motif === 'horizon' && (
        <View style={{ position: 'absolute', left: -px * 0.2, right: -px * 0.2, top: px * 0.54, height: px, backgroundColor: MOTIF_TONE[tone], transform: [{ rotate: '-13deg' }] }} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.center, !small && motif !== 'medallion' ? { paddingTop: px * (motif === 'arch' ? 0.12 : 0.04) } : null]}>
        <Icon name={set.coverIcon as IconName} size={glyph} color={TONE[tone].ink} style={{ opacity: 0.9 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
