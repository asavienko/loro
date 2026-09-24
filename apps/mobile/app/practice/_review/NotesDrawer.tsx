import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { copy } from '../../../src/lib/copy'
import { haptics } from '../../../src/lib/haptics'
import { useLocale } from '../../../src/lib/i18n'
import { stageNoteFields, type StagePane } from '../_stream/stageNotes'
import { Arrival, Pressable, Row, Text } from '../../../src/ui/primitives'
import { stationeryElevation } from '../../../src/ui/elevation'
import { useTheme } from '../../../src/ui/ThemeProvider'
import { ink, line, semantic, space, surface } from '../../../src/ui/theme'
import type { PhraseView } from '../../../src/store'
import {
  DRAWER_GAP,
  DRAWER_MT,
  DRAWER_PAD,
  DRAWER_RADIUS,
  NOTE_PAD,
  NOTE_RADIUS,
  TAB_BAR_PT,
  TAB_BAR_PX,
  TAB_FACE,
  TAB_GAP,
  TAB_MARK,
  TAB_MARK_GRAMMAR,
  TAB_MARK_MNEMONIC,
  TAB_MARK_PHONETICS,
  TAB_ON_WEIGHT,
  TAB_PB,
  TAB_WEIGHT,
  TAB_RULE,
  TAB_X,
} from './geometry'

const TABS: readonly StagePane[] = ['mnemonic', 'grammar', 'phonetics']

const TAB_MARKS: Record<StagePane, string> = {
  mnemonic: TAB_MARK_MNEMONIC,
  grammar: TAB_MARK_GRAMMAR,
  phonetics: TAB_MARK_PHONETICS,
}

export function NotesDrawer({
  phrase,
  testID,
}: {
  phrase: PhraseView
  testID: string
}) {
  useLocale()
  const { accent } = useTheme()
  const fields = stageNoteFields(phrase)
  const [pane, setPane] = useState<StagePane>('mnemonic')
  const labels = {
    mnemonic: copy.review.tab.mnemonic,
    grammar: copy.review.tab.grammar,
    phonetics: copy.review.tab.phonetics,
  }
  const body =
    pane === 'mnemonic'
      ? (fields.mnemonic ?? copy.review.tab.mnemonicEmpty)
      : pane === 'phonetics'
        ? (fields.phonetics ?? copy.review.tab.phoneticsEmpty)
        : (fields.grammar ?? copy.review.tab.grammarEmpty)
  const filled =
    (pane === 'mnemonic' && fields.mnemonic !== undefined) ||
    (pane === 'phonetics' && fields.phonetics !== undefined) ||
    (pane === 'grammar' && fields.grammar !== undefined)
  return (
    <View testID={testID} style={[styles.lift, stationeryElevation('emblemSoft')]}>
      <View style={styles.shell}>
        <View testID="review-notes-tabs" style={styles.tabs}>
        <Row gap={space['1']} align="flex-end" wrap>
          {TABS.map((tab) => {
            const selected = pane === tab
            const label = labels[tab]
            return (
              <Pressable
                key={tab}
                feedback="smallButton"
                pressMotion="deboss"
                accessibilityLabel={label}
                selected={selected}
                onPress={() => {
                  haptics.select()
                  setPane(tab)
                }}
                style={[
                  styles.tab,
                  {
                    borderBottomColor: selected ? accent.accent : 'transparent',
                  },
                ]}
              >
                <Row align="center" gap={TAB_GAP}>
                  <View testID={`review-tab-mark-${tab}`}>
                    <Text
                      variant="labelSm"
                      color={selected ? accent.accent : ink.ink2}
                      style={styles.tabMark}
                    >
                      {TAB_MARKS[tab]}
                    </Text>
                  </View>
                  <View testID={`review-tab-label-${tab}`}>
                    <Text
                      variant="labelSm"
                      color={selected ? accent.accent : ink.ink2}
                      style={[
                        styles.tabLabel,
                        { fontWeight: selected ? TAB_ON_WEIGHT : TAB_WEIGHT },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </Row>
              </Pressable>
            )
          })}
        </Row>
        </View>
        <View testID="review-notes-pane" style={styles.pane}>
          <Arrival key={pane} kind="fadeIn">
            {filled ? (
              <View style={styles.hook}>
                <Text variant="bodySm" color={semantic.hook.text}>
                  {copy.phrase.hookGlyph} {body}
                </Text>
              </View>
            ) : (
              <Text variant="bodySm" color={ink.ink2}>
                {body}
              </Text>
            )}
          </Arrival>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  lift: {
    marginTop: DRAWER_MT,
    borderRadius: DRAWER_RADIUS,
  },
  shell: {
    backgroundColor: surface.card,
    borderRadius: DRAWER_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
  },
  tabs: {
    paddingHorizontal: TAB_BAR_PX,
    paddingTop: TAB_BAR_PT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line.default,
    alignItems: 'flex-end',
  },
  tab: {
    paddingHorizontal: TAB_X,
    paddingBottom: TAB_PB,
    borderBottomWidth: TAB_RULE,
  },
  tabMark: { fontSize: TAB_MARK, lineHeight: TAB_MARK, fontWeight: '700' },
  tabLabel: { fontSize: TAB_FACE },
  pane: {
    padding: DRAWER_PAD,
    gap: DRAWER_GAP,
  },
  hook: {
    backgroundColor: semantic.hook.bg,
    borderRadius: NOTE_RADIUS,
    padding: NOTE_PAD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.default,
  },
})
