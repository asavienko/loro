import { View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { LOCK_IN_DAYS_TO_GRADUATE } from '@loro/core'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { haptics } from '../../src/lib/haptics'
import { Arrival, Button, EmojiTile, Pressable, Row, Stack, Text } from '../../src/ui/primitives'
import { stationeryElevation } from '../../src/ui/elevation'
import { accent, ink, space, surface } from '../../src/ui/theme'
import type { PhraseView } from '../../src/store'
import {
  FIRST_FOLD_TILES,
  JUMP_COPY_GAP,
  JUMP_COPY_X,
  JUMP_COPY_Y,
  JUMP_GAP,
  JUMP_HEADING,
  JUMP_HEADING_LINE,
  JUMP_RADIUS,
  JUMP_TITLE,
  JUMP_TITLE_LINE,
  JUMP_TITLE_TRACK,
  LABEL_BOLD_WEIGHT,
  TILE_THUMB,
} from './geometry'

export function JumpBackIn({ set, lockedIn }: { set: readonly PhraseView[]; lockedIn: number }) {
  useLocale()
  return (
    <View style={styles.block}>
      <Row justify="space-between" align="center" wrap style={styles.header}>
        <View testID="today-jump-heading">
          <Text variant="title3" color={ink.ink} style={styles.heading}>
            {copy.today.rhythm.jumpBack}
          </Text>
        </View>
        <Row gap={space['2']} align="baseline" wrap>
          <Text variant="label" color={accent.accentInk}>
            {copy.today.lockedIn(lockedIn, set.length)}
          </Text>
          <Pressable
            feedback="row"
            accessibilityLabel={copy.a11y.today.browse}
            onPress={() => {
              haptics.select()
              router.push('/add')
            }}
          >
            <View testID="today-jump-browse">
              <Text variant="labelSm" color={accent.accentInk} style={styles.browse}>
                {copy.today.rhythm.browse}
              </Text>
            </View>
          </Pressable>
        </Row>
      </Row>
      {set.length === 0 ? (
        <Stack gap={space['2']}>
          <Text variant="caption" color={ink.muted}>
            {copy.today.empty.body}
          </Text>
          <Button
            label={copy.common.addPhrases}
            variant="secondary"
            onPress={() => {
              haptics.select()
              router.push('/add')
            }}
          />
        </Stack>
      ) : (
        <View style={styles.grid}>
          {set.slice(0, FIRST_FOLD_TILES).map((phrase) => (
            <SetTile key={phrase.id} phrase={phrase} onFold />
          ))}
        </View>
      )}
    </View>
  )
}

export function JumpBackRest({ set }: { set: readonly PhraseView[] }) {
  const rest = set.slice(FIRST_FOLD_TILES)
  if (rest.length === 0) return null
  return (
    <View style={styles.grid}>
      {rest.map((phrase) => (
        <SetTile key={phrase.id} phrase={phrase} />
      ))}
    </View>
  )
}

function SetTile({ phrase, onFold }: { phrase: PhraseView; onFold?: boolean }) {
  useLocale()
  const lockInDay = Math.min(phrase.lockInDays + 1, LOCK_IN_DAYS_TO_GRADUATE)
  return (
    <Arrival kind="fadeIn" style={styles.tileWrap}>
      <View
        testID={onFold === true ? 'today-jump-tile' : 'today-jump-reserved'}
        style={styles.tileChrome}
      >
      <Pressable
        feedback="row"
        pressMotion="deboss"
        accessibilityLabel={copy.a11y.today.phraseRow(
          phrase.targetText,
          phrase.automaticity,
          lockInDay,
          LOCK_IN_DAYS_TO_GRADUATE,
        )}
        accessibilityHint={copy.a11y.common.opensPhraseDetails}
        onPress={() => {
          haptics.select()
          router.push(`/phrase/${phrase.id}`)
        }}
        style={styles.tile}
      >
        <EmojiTile emoji={phrase.emoji} size={TILE_THUMB} radius={0} background={surface.sunken2} />
        <View testID="today-jump-copy" style={styles.tileCopy}>
          <View testID="today-jump-title">
            <Text variant="captionSm" color={ink.ink} lang="target" numberOfLines={1} style={styles.title}>
              {phrase.targetText}
            </Text>
          </View>
          <View testID="today-jump-day">
            <Text variant="labelSm" color={ink.ink2} numberOfLines={1} style={styles.day}>
              {copy.today.lockInDay(lockInDay, LOCK_IN_DAYS_TO_GRADUATE)}
            </Text>
          </View>
        </View>
      </Pressable>
      </View>
    </Arrival>
  )
}

const styles = StyleSheet.create({
  block: { gap: JUMP_GAP },
  header: { paddingBottom: 0 },
  heading: {
    fontSize: JUMP_HEADING,
    lineHeight: JUMP_HEADING_LINE,
    fontWeight: '600',
  },
  browse: { textTransform: 'uppercase', fontWeight: LABEL_BOLD_WEIGHT },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['1'],
  },
  tileWrap: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 148,
  },
  tileChrome: {
    borderRadius: JUMP_RADIUS,
    ...stationeryElevation('emblemSoft'),
  },
  tile: {
    height: TILE_THUMB,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: surface.card,
    borderRadius: JUMP_RADIUS,
    overflow: 'hidden',
  },
  tileCopy: {
    flex: 1,
    minWidth: 0,
    height: TILE_THUMB,
    paddingHorizontal: JUMP_COPY_X,
    paddingVertical: JUMP_COPY_Y,
    justifyContent: 'center',
    gap: JUMP_COPY_GAP,
  },
  title: {
    fontWeight: '600',
    fontSize: JUMP_TITLE,
    lineHeight: JUMP_TITLE_LINE,
    letterSpacing: JUMP_TITLE_TRACK,
    textTransform: 'none',
  },
  day: { textTransform: 'none', fontWeight: LABEL_BOLD_WEIGHT },
})
