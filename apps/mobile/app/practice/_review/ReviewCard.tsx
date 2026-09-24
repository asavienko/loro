import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { copy, themeLabel } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { Arrival, Pressable, ProgressBar, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { useTheme } from '../../../src/ui/ThemeProvider'
import {
  difficultyMeta,
  ink,
  onDark,
  radius,
  semantic,
  space,
  surface,
} from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import { NotesDrawer } from './NotesDrawer'
import {
  AUTO_GAP,
  AUTO_MT,
  AUTO_PAD,
  CARD_GAP,
  CARD_GUTTER,
  COPY_GAP,
  DUE_CHIP_WEIGHT,
  LABEL_SM_WEIGHT,
  TRACK_GAP,
  CARD_PAD,
  CARD_RADIUS,
  CHEVRON,
  CHEVRON_FACE,
  CHEVRON_SIZE,
  DECK_LINE,
  DECK_TITLE,
  ECHO,
  HEAR_FACE,
  EQ_BAR,
  EQ_H,
  EQ_MARK,
  EQ_MT,
  INDEX_FACE,
  INDEX_TRACK,
  HEAR_GLYPH,
  MEANING,
  MEANING_LINE,
  MEANING_MT,
  RESP_MT,
  TAGS_MB,
  PHRASE_LINE,
  PHRASE_TITLE,
  PHRASE_TRACK,
  PHRASE_TRACK_RECEDED,
  STOP_GLYPH,
  TAG_PAD_X,
  TAG_PAD_Y,
  reviewIndex,
} from './geometry'

export function ReviewCard({
  phrase,
  revealed,
  playing,
  canPlay,
  onReveal,
  onHear,
}: {
  phrase: PhraseView
  revealed: boolean
  playing: boolean
  canPlay: boolean
  onReveal: () => void
  onHear: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  const diff = difficultyMeta[phrase.difficulty]
  const resp = phrase.catalog?.resp
  const syllables = phrase.catalog?.syl?.length
  const automaticity = phrase.automaticity

  return (
    <Arrival kind="fadeIn">
      {revealed ? null : (
        <>
          <View testID="review-deck-head" style={styles.deckHead}>
            <Row gap={space['2']} align="center" wrap>
              <View testID="review-deck-title">
                <Text variant="title3" color={ink.ink} style={styles.deckTitle}>
                  {copy.review.deck.title}
                </Text>
              </View>
              <View testID="review-deck-badge" style={styles.deckBadge}>
                <Text variant="labelSm" color={ink.ink2} style={styles.labelSmChip}>
                  {copy.review.deck.badge}
                </Text>
              </View>
            </Row>
          </View>
        </>
      )}
      <View testID="review-card" style={[styles.card, stationeryElevation('emblemRaised')]}>
        <Row align="flex-start" justify="space-between" gap={space['2']}>
          <Row align="flex-start" gap={space['2']} style={styles.lead}>
            <View
              testID="review-index"
              style={[styles.eqMark, { backgroundColor: accent.wash }]}
            >
              <Row gap={EQ_BAR} align="flex-end" style={styles.eqRow}>
                <View
                  style={[
                    styles.eqBar,
                    { height: playing ? 8 : 6, backgroundColor: accent.accent },
                  ]}
                />
                <View
                  style={[
                    styles.eqBar,
                    { height: playing ? EQ_H : 8, backgroundColor: accent.accent },
                  ]}
                />
                <View
                  style={[
                    styles.eqBar,
                    { height: playing ? 10 : 7, backgroundColor: accent.accent },
                  ]}
                />
              </Row>
            </View>
            <View testID="review-copy" style={styles.copy}>
              <View testID="review-tags" style={styles.tags}>
              <Row wrap gap={space['1.5']}>
                <View testID="review-due-chip" style={[styles.tag, { backgroundColor: accent.wash }]}>
                  <Text variant="labelSm" color={accent.accentInk} style={styles.dueChip}>
                    {copy.review.due.waiting}
                  </Text>
                </View>
                <View testID="review-theme-chip" style={[styles.tag, { backgroundColor: surface.sunken2 }]}>
                  <Text variant="labelSm" color={ink.ink2} style={styles.labelSmChip}>
                    {themeLabel(phrase.theme)}
                  </Text>
                </View>
                <View testID="review-difficulty-chip" style={[styles.tag, { backgroundColor: diff.bg }]}>
                  <Text variant="labelSm" color={diff.color} style={styles.labelSmChip}>
                    {copy.difficulty[phrase.difficulty]}
                  </Text>
                </View>
                {syllables !== undefined && syllables > 0 ? (
                  <View testID="review-syllables">
                    <Text variant="labelSm" color={ink.muted} style={styles.labelSmChip}>
                      {copy.review.syllables(syllables)}
                    </Text>
                  </View>
                ) : null}
              </Row>
              </View>
              <View testID="review-phrase">
                <Text variant="title3" color={ink.ink} lang="target" style={styles.phrase}>
                  {phrase.targetText}
                </Text>
              </View>
              {resp !== undefined && resp.length > 0 ? (
                <View testID="review-resp" style={styles.respWrap}>
                <Text variant="bodySm" color={accent.accentInk} style={styles.resp}>
                  {resp}
                </Text>
                </View>
              ) : null}
              <View testID="review-meaning">
                <Text variant="bodySm" color={ink.ink2} style={styles.meaning}>
                  {phrase.translation}
                </Text>
              </View>
            </View>
          </Row>
          <View style={styles.actions}>
            {canPlay ? (
              <View testID="review-hear" style={[styles.echo, stationeryElevation('emblemSoft')]}>
                <Pressable
                  feedback="icon"
                  pressMotion="deboss"
                  accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.hear}
                  onPress={() => {
                    haptics.confirm()
                    onHear()
                  }}
                  style={[styles.echoHit, { backgroundColor: accent.accent }]}
                >
                  <View testID="review-hear-mark">
                    <Text color={accent.accentOnDark} style={styles.hearGlyph}>
                      {playing ? STOP_GLYPH : HEAR_GLYPH}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
            <View testID="review-reveal" style={styles.chevron}>
              <Pressable
                feedback="icon"
                pressMotion="deboss"
                accessibilityRole="button"
                accessibilityLabel={revealed ? copy.a11y.review.cardShown : copy.review.reveal}
                onPress={() => {
                  haptics.select()
                  onReveal()
                }}
                style={styles.chevronHit}
              >
                <View testID="review-reveal-mark">
                  <Text
                    color={ink.ink2}
                    style={[styles.chevronGlyph, revealed ? styles.chevronOpen : undefined]}
                  >
                    {CHEVRON}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Row>
        {automaticity > 0 ? (
          <View testID="review-auto" style={styles.auto}>
            <View testID="review-auto-face">
              <Text variant="labelSm" color={semantic.success.text} style={styles.labelSmChip}>
                {copy.review.automaticity(automaticity)}
              </Text>
            </View>
            <View style={styles.autoBar}>
              <ProgressBar value={automaticity / 100} color={semantic.success.text} height={6} />
            </View>
          </View>
        ) : null}
        {revealed ? <NotesDrawer phrase={phrase} testID="review-notes" /> : null}
      </View>
    </Arrival>
  )
}

export function ReviewReceded({
  phrase,
  index,
  canPlay,
  playing,
  onHear,
}: {
  phrase: PhraseView
  index: number
  canPlay: boolean
  playing: boolean
  onHear: () => void
}) {
  useLocale()
  const { accent } = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <View
      testID="review-receded-card"
      style={[styles.card, styles.receded, stationeryElevation('emblemSoft')]}
    >
      <Row align="flex-start" justify="space-between" gap={space['2']}>
        <Row align="flex-start" gap={space['2']} style={styles.lead}>
        <View testID="review-receded-index" style={styles.recededMark}>
          <Text variant="captionSm" color={ink.ink2} style={styles.indexFace}>
            {reviewIndex(index)}
          </Text>
        </View>
        <View style={styles.copy}>
          <Row wrap gap={space['1.5']} style={styles.tags}>
            <View testID="review-receded-theme" style={[styles.tag, { backgroundColor: surface.sunken2 }]}>
              <Text variant="labelSm" color={ink.ink2} style={styles.labelSmChip}>
                {themeLabel(phrase.theme)}
              </Text>
            </View>
          </Row>
          <View testID="review-receded-phrase">
            <Text variant="title3" color={ink.ink} lang="target" style={styles.recededPhrase}>
              {phrase.targetText}
            </Text>
          </View>
          <Text variant="bodySm" color={ink.ink2} style={styles.meaning}>
            {phrase.translation}
          </Text>
        </View>
        </Row>
        {canPlay ? (
          <View style={styles.actions}>
            <View
              testID="review-receded-hear"
              style={[styles.echo, stationeryElevation('emblemSoft')]}
            >
              <Pressable
                feedback="icon"
                pressMotion="deboss"
                accessibilityLabel={playing ? copy.audioSpeech.stop : copy.audioSpeech.hear}
                onPress={() => {
                  haptics.confirm()
                  onHear()
                }}
                style={[styles.echoHit, { backgroundColor: accent.accent }]}
              >
                <View testID="review-hear-mark">
                  <Text color={accent.accentOnDark} style={styles.hearGlyph}>
                    {playing ? STOP_GLYPH : HEAR_GLYPH}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View testID="review-receded-reveal" style={styles.chevron}>
              <Pressable
                feedback="icon"
                pressMotion="deboss"
                accessibilityRole="button"
                accessibilityLabel={open ? copy.a11y.review.notesShown : copy.a11y.review.showNotes}
                onPress={() => {
                  haptics.select()
                  setOpen((current) => !current)
                }}
                style={styles.chevronHit}
              >
                <View testID="review-reveal-mark">
                  <Text
                    color={ink.ink2}
                    style={[styles.chevronGlyph, open ? styles.chevronOpen : undefined]}
                  >
                    {CHEVRON}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Row>
      {canPlay && open ? <NotesDrawer phrase={phrase} testID="review-receded-notes" /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  deckHead: {
    paddingHorizontal: CARD_GUTTER,
    paddingBottom: CARD_PAD,
  },
  deckTitle: { fontSize: DECK_TITLE, lineHeight: DECK_LINE, fontWeight: '600' },
  deckBadge: {
    backgroundColor: surface.sunken,
    paddingHorizontal: TAG_PAD_X,
    paddingVertical: TAG_PAD_Y,
    borderRadius: radius.pill,
  },
  card: {
    marginHorizontal: CARD_GUTTER,
    padding: CARD_PAD,
    borderRadius: CARD_RADIUS,
    backgroundColor: onDark.primary,
    gap: CARD_GAP,
  },
  receded: { marginTop: TRACK_GAP },
  recededMark: {
    width: EQ_MARK,
    height: EQ_MARK,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: EQ_MT,
    backgroundColor: surface.sunken,
  },
  indexFace: { fontSize: INDEX_FACE, letterSpacing: INDEX_TRACK },
  lead: { flex: 1, minWidth: 0 },
  copy: { flex: 1, minWidth: 0, gap: COPY_GAP },
  eqMark: {
    width: EQ_MARK,
    height: EQ_MARK,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: EQ_MT,
  },
  eqRow: { height: EQ_H },
  eqBar: { width: EQ_BAR, borderRadius: radius.pill },
  tags: { marginBottom: TAGS_MB },
  tag: {
    paddingHorizontal: TAG_PAD_X,
    paddingVertical: TAG_PAD_Y,
    borderRadius: radius.pill,
  },
  dueChip: { fontWeight: DUE_CHIP_WEIGHT },
  labelSmChip: { fontWeight: LABEL_SM_WEIGHT },
  phrase: {
    fontSize: PHRASE_TITLE,
    lineHeight: PHRASE_LINE,
    letterSpacing: PHRASE_TRACK,
    fontWeight: '600',
  },
  recededPhrase: {
    fontSize: PHRASE_TITLE,
    lineHeight: PHRASE_LINE,
    letterSpacing: PHRASE_TRACK_RECEDED,
    fontWeight: '600',
  },
  respWrap: { marginTop: RESP_MT },
  resp: { fontVariant: ['tabular-nums'] },
  meaning: {
    fontSize: MEANING,
    lineHeight: MEANING_LINE,
    fontWeight: '400',
    fontStyle: 'italic',
    marginTop: MEANING_MT,
  },
  actions: { alignItems: 'flex-end', gap: space['2'] },
  echo: {
    width: ECHO,
    height: ECHO,
  },
  echoHit: {
    width: ECHO,
    height: ECHO,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearGlyph: { fontSize: HEAR_FACE, lineHeight: HEAR_FACE },
  chevron: {
    width: CHEVRON_SIZE,
    height: CHEVRON_SIZE,
  },
  chevronHit: {
    width: CHEVRON_SIZE,
    height: CHEVRON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronGlyph: { fontSize: CHEVRON_FACE, lineHeight: CHEVRON_FACE },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  auto: {
    marginTop: AUTO_MT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AUTO_GAP,
    backgroundColor: surface.sunken,
    borderRadius: radius.lg,
    padding: AUTO_PAD,
  },
  autoBar: { flex: 1 },
})
