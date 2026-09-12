import { usePullDown } from '../primitives/usePullDown'
import { useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, SectionLabel, Sheet, Text } from '../primitives'
import { border, ink, line, MIN_TAP, space } from '../theme'

/** Navigation.dc.html:95–102, 380–397. No invented ongoing work or unbuilt destinations. */
export function NavigationMenu({
  place,
  openLabel,
  title,
  groupLabel,
  dismissLabel,
  hereLabel,
  reveal,
  chevron,
  destinations,
  ongoing,
}: {
  place: string
  openLabel: string
  title: string
  groupLabel: string
  dismissLabel: string
  hereLabel: string
  reveal: string
  chevron: string
  destinations: readonly {
    label: string
    current: boolean
    currentLabel: string
    onPress: () => void
  }[]
  ongoing?: { label: string; onPress: () => void; heading: string } | undefined
}) {
  const [visible, setVisible] = useState(false)
  const pullHandlers = usePullDown(() => {
    setVisible(true)
  })
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return (
    <>
      <View style={[s.chrome, { paddingTop: insets.top }]}>
        <View testID="navigation-pull-handle" style={s.spine} {...pullHandlers}>
          <Pressable
            feedback="row"
            accessibilityLabel={openLabel}
            onPress={() => {
              setVisible(true)
            }}
            style={s.handle}
          >
            <Text variant="bodySm" color={ink.ink} style={s.place}>
              {place}
            </Text>
            <Text variant="labelSm" color={ink.muted} style={s.caret}>
              {reveal}
            </Text>
          </Pressable>
        </View>
        {ongoing !== undefined && (
          <Pressable
            feedback="row"
            accessibilityLabel={ongoing.label}
            onPress={ongoing.onPress}
            style={s.ongoing}
          >
            <Text variant="captionSm" color={ink.muted}>
              {ongoing.heading}
            </Text>
            <Text variant="captionSm" color={ink.ink}>
              {ongoing.label}
            </Text>
          </Pressable>
        )}
      </View>
      <Sheet
        visible={visible}
        onDismiss={() => {
          setVisible(false)
        }}
        dismissLabel={dismissLabel}
      >
        <Text variant="title3" color={ink.ink}>
          {title}
        </Text>
        <ScrollView style={{ maxHeight: height * MENU_HEIGHT_FRACTION }}>
          <SectionLabel>{groupLabel}</SectionLabel>
          {destinations.map((destination) =>
            destination.current ? (
              <View
                key={destination.label}
                style={s.row}
                accessible
                accessibilityLabel={destination.currentLabel}
                aria-label={destination.currentLabel}
              >
                <Text variant="body" color={ink.ink} style={s.grow}>
                  {destination.label}
                </Text>
                <Text variant="captionSm" color={ink.muted}>
                  {hereLabel}
                </Text>
              </View>
            ) : (
              <Pressable
                key={destination.label}
                feedback="row"
                accessibilityLabel={destination.label}
                onPress={() => {
                  setVisible(false)
                  destination.onPress()
                }}
                style={s.row}
              >
                <Text variant="body" color={ink.ink} style={s.grow}>
                  {destination.label}
                </Text>
                <Text variant="captionSm" color={ink.muted}>
                  {chevron}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
      </Sheet>
    </>
  )
}

const MENU_HEIGHT_FRACTION = 0.65
const SPINE_HEIGHT = 28
const PLACE_SIZE = 11.5
const CARET_SIZE = 10
const HANDLE_GAP = 5
const ROW_PADDING = 13
const s = StyleSheet.create({
  chrome: {
    paddingHorizontal: space['5'],
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  spine: {
    touchAction: 'none',
    userSelect: 'none',
    minHeight: SPINE_HEIGHT,
    justifyContent: 'center',
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HANDLE_GAP,
    minHeight: SPINE_HEIGHT,
    alignSelf: 'flex-start',
  },
  ongoing: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    minHeight: MIN_TAP,
  },
  place: { fontSize: PLACE_SIZE },
  caret: { fontSize: CARET_SIZE },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2.5'],
    paddingVertical: ROW_PADDING,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
})
