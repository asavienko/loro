import { StyleSheet, View } from 'react-native'
import { copy, themeLabel } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { Arrival, EmojiTile, Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { useTheme } from '../../../src/ui/ThemeProvider'
import { ink, onDark, radius, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import {
  BADGE_PAD_X,
  BADGE_PAD_Y,
  LABEL_SM_WEIGHT,
  HERO_GAP,
  HERO_INNER_GAP,
  HERO_PAD,
  HERO_PAD_BOTTOM,
  HERO_SUB_MT,
  HERO_TITLE,
  HERO_TITLE_LINE,
  HERO_TITLE_TRACK,
  ICON,
  LOVE_FACE,
  LOVE_GLYPH,
  GRADE_FACE,
  GRADE_FACE_LINE,
  GRADE_FACE_TRACK,
  MEANING,
  MEANING_LINE,
  MODE_PAD_X,
  MODE_PAD_Y,
  PLAY,
  LOVE_ROW_PT,
  PLAY_CLUSTER_GAP,
  PLAY_ROW_PT,
  PACK_PAUSE_H,
  PACK_PAUSE_W,
  PACK_PLAY_TRI_H,
  PACK_PLAY_TRI_W,
  SHUFFLE,
  SHUFFLE_GLYPH,
  SLEEVE,
  SLEEVE_GAP,
  SLEEVE_GLYPH,
  SLEEVE_RADIUS,
  STATS_PAD_X,
  STATS_PAD_Y,
  STATS_RADIUS,
} from './geometry'

export function PackHero({
  phrase,
  dueCount,
  canPlay,
  playing,
  compact,
  onPlay,
  onToggleLoved,
}: {
  phrase: PhraseView
  dueCount: number
  canPlay: boolean
  playing: boolean
  compact: boolean
  onPlay: () => void
  onToggleLoved: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  return (
    <Arrival kind="fadeIn">
      <View testID="review-pack-hero" style={[styles.band, compact && styles.bandCompact]}>
        <View testID="review-pack-inner" style={styles.inner}>
        <Row align="flex-start" gap={SLEEVE_GAP}>
          <View testID="review-sleeve" style={[styles.sleeveLift, stationeryElevation('emblemRaised')]}>
            <View style={styles.sleeve}>
            <EmojiTile
              emoji={phrase.emoji}
              size={SLEEVE}
              fontSize={SLEEVE_GLYPH}
              radius={SLEEVE_RADIUS}
              background={surface.sunken}
            />
            </View>
          </View>
          <View style={styles.meta}>
            <View style={styles.head}>
              <View testID="review-pack-badge" style={styles.badge}>
                <Text variant="labelSm" color={ink.ink3} style={styles.badgeFace}>
                  {copy.review.badge}
                </Text>
              </View>
              <View testID="review-hero-title">
                <Text
                  variant="title1"
                  color={ink.ink}
                  numberOfLines={2}
                  style={styles.title}
                >
                  {themeLabel(phrase.theme)}
                </Text>
              </View>
            </View>
            {compact ? null : (
              <View testID="review-hero-sub" style={styles.sub}>
                <Text variant="bodySm" color={ink.ink2} numberOfLines={2} style={styles.subFace}>
                  {copy.review.due.body}
                </Text>
              </View>
            )}
          </View>
        </Row>
        {compact ? null : (
          <>
            <View testID="review-hero-stats" style={styles.stats}>
              <Text variant="captionSm" color={ink.ink2} style={styles.statsFace}>
                {copy.review.due.count(dueCount)}
              </Text>
            </View>
            <View testID="review-love-row" style={styles.loveRow}>
            <Row justify="flex-start" align="center">
              <View testID="review-love" style={[styles.icon, stationeryElevation('emblemSoft')]}>
                <Pressable
                  feedback="icon"
                  pressMotion="deboss"
                  accessibilityLabel={
                    phrase.loved ? copy.a11y.common.removeFromLoved : copy.a11y.stream.loveThisPhrase
                  }
                  onPress={() => {
                    haptics.select()
                    onToggleLoved()
                  }}
                  style={styles.iconHit}
                >
                  <Text color={phrase.loved ? accent.accentInk : ink.ink2} style={styles.love}>
                    {LOVE_GLYPH}
                  </Text>
                </Pressable>
              </View>
            </Row>
            </View>
          </>
        )}
        </View>
        {compact ? null : (
            <View testID="review-play-row" style={styles.playRow}>
            <Row justify="space-between" align="center" wrap>
              <View testID="review-play-cluster" style={styles.playCluster}>
                {canPlay ? (
                  <View testID="review-play" style={styles.play}>
                    <Pressable
                      feedback="button"
                      pressMotion="deboss"
                      elevation="playRaised"
                      accessibilityLabel={playing ? copy.review.stopDeck : copy.review.playDeck}
                      onPress={() => {
                        haptics.confirm()
                        onPlay()
                      }}
                      style={[
                        styles.playHit,
                        stationeryElevation('playRaised'),
                        { backgroundColor: accent.accent },
                      ]}
                    >
                      {playing ? <PauseMark /> : <PlayMark />}
                      <View
                        testID="review-shuffle"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={[
                          styles.shuffle,
                          stationeryElevation('emblemSoft'),
                          { borderColor: surface.app },
                        ]}
                      >
                        <Text variant="labelSm" color={accent.accentInk}>
                          {SHUFFLE_GLYPH}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
                <View testID="review-mode" style={styles.mode}>
                  <Text variant="captionSm" color={ink.ink} style={styles.modeFace}>
                    {copy.review.mode}
                  </Text>
                </View>
              </View>
            </Row>
            </View>
        )}
      </View>
    </Arrival>
  )
}

function PlayMark() {
  return <View testID="review-play-tri" style={styles.tri} />
}

function PauseMark() {
  return (
    <View testID="review-pack-pause">
      <Row gap={space['1']}>
        <View testID="review-pack-pause-bar" style={styles.pause} />
        <View style={styles.pause} />
      </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: surface.card,
    paddingHorizontal: HERO_PAD,
    paddingTop: HERO_PAD,
    paddingBottom: HERO_PAD_BOTTOM,
    gap: HERO_GAP,
  },
  inner: { gap: HERO_INNER_GAP },
  bandCompact: {
    paddingBottom: space['3'],
    gap: space['2'],
  },
  sleeveLift: { width: SLEEVE, height: SLEEVE, borderRadius: SLEEVE_RADIUS },
  sleeve: {
    width: '100%',
    height: '100%',
    borderRadius: SLEEVE_RADIUS,
    overflow: 'hidden',
  },
  meta: { flex: 1, minWidth: 0, justifyContent: 'center' },
  head: { gap: space['1'] },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: surface.sunken2,
    paddingHorizontal: BADGE_PAD_X,
    paddingVertical: BADGE_PAD_Y,
    borderRadius: radius.pill,
  },
  badgeFace: { fontWeight: LABEL_SM_WEIGHT },
  title: {
    fontSize: HERO_TITLE,
    lineHeight: HERO_TITLE_LINE,
    letterSpacing: HERO_TITLE_TRACK,
    fontWeight: '600',
    fontStyle: 'normal',
  },
  sub: { marginTop: HERO_SUB_MT },
  subFace: {
    fontSize: MEANING,
    lineHeight: MEANING_LINE,
  },
  stats: {
    backgroundColor: surface.sunken,
    borderRadius: STATS_RADIUS,
    paddingHorizontal: STATS_PAD_X,
    paddingVertical: STATS_PAD_Y,
  },
  statsFace: {
    fontSize: GRADE_FACE,
    lineHeight: GRADE_FACE_LINE,
    letterSpacing: GRADE_FACE_TRACK,
  },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHit: {
    width: ICON,
    height: ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  love: { fontSize: LOVE_FACE },
  loveRow: { paddingTop: LOVE_ROW_PT },
  playRow: { paddingTop: PLAY_ROW_PT },
  playCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: PLAY_CLUSTER_GAP,
  },
  play: {
    width: PLAY,
    height: PLAY,
  },
  playHit: {
    width: PLAY,
    height: PLAY,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffle: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: SHUFFLE,
    height: SHUFFLE,
    borderRadius: radius.pill,
    backgroundColor: surface.app,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  mode: {
    backgroundColor: surface.sunken2,
    paddingHorizontal: MODE_PAD_X,
    paddingVertical: MODE_PAD_Y,
    borderRadius: radius.pill,
  },
  modeFace: {
    fontSize: GRADE_FACE,
    lineHeight: GRADE_FACE_LINE,
    letterSpacing: GRADE_FACE_TRACK,
  },
  tri: {
    width: 0,
    height: 0,
    marginLeft: space['0.5'],
    borderTopWidth: PACK_PLAY_TRI_H,
    borderBottomWidth: PACK_PLAY_TRI_H,
    borderLeftWidth: PACK_PLAY_TRI_W,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: onDark.primary,
  },
  pause: {
    width: PACK_PAUSE_W,
    height: PACK_PAUSE_H,
    borderRadius: radius.pill,
    backgroundColor: onDark.primary,
  },
})
