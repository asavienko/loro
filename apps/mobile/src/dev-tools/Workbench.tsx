import {
  accents,
  ink as generatedInk,
  onDark as generatedOnDark,
  scale,
  semantic as generatedSemantic,
  surface as generatedSurface,
  type AccentName,
} from '@loro/design-tokens'
import { createContrastReport } from '@loro/design-tokens/contrast'
import { createElement, useMemo, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable as RNPressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from 'react-native'
import { ThemeProvider, useTheme, type TextScale } from '../ui/ThemeProvider'
import { EmptyState, PhraseRow } from '../ui/components'
import {
  Button,
  Card,
  Chip,
  Grid,
  ProgressBar,
  Row,
  SectionHeader,
  Stack,
  Text,
} from '../ui/primitives'
import { ink, line, radius, semantic, space, surface, type as typeStyle } from '../ui/theme'
import {
  PENDING_NAVIGATION_SPECIMENS,
  PRODUCTION_SPECIMENS,
  SPECIMEN_STATE_MATRIX,
} from './specimens'
import {
  GENERATED_TOKEN_RECORDS,
  searchTokenRecords,
  TOKEN_GROUPS,
  type TokenRecord,
} from './tokens'

type SafeAreaPreset = 'none' | 'notch' | 'home-indicator'

interface DevicePreset {
  readonly id: 'authored' | 'phone' | 'tablet' | 'web'
  readonly label: string
  readonly width: number
  readonly height: number
}

const AUTHORED_DEVICE: DevicePreset = {
  id: 'authored',
  label: 'Authored · 344 × 732',
  width: 344,
  height: 732,
}
const DEVICE_PRESETS: readonly DevicePreset[] = [
  AUTHORED_DEVICE,
  { id: 'phone', label: 'Phone · 390 × 844', width: 390, height: 844 },
  { id: 'tablet', label: 'Tablet · 768 × 1024', width: 768, height: 1024 },
  { id: 'web', label: 'Web · 1180 × 800', width: 1180, height: 800 },
]

const TEXT_SCALES: readonly { readonly value: TextScale; readonly label: string }[] = [
  { value: 1, label: '100%' },
  { value: 2, label: '200%' },
  { value: 3.1, label: '310%' },
]

const CONTRAST_REPORT = createContrastReport({
  surface: generatedSurface,
  ink: generatedInk,
  semantic: generatedSemantic,
  accents,
  onDark: generatedOnDark,
  scale,
})

function colorSwatch(value: string) {
  const isColor = value.startsWith('#') || value.startsWith('rgb')
  if (!isColor) return null
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: line.strong,
        backgroundColor: value,
      }}
    />
  )
}

function WorkbenchHeading({
  children,
  size = 'section',
}: {
  children: ReactNode
  size?: 'major' | 'section' | 'group'
}) {
  const style =
    size === 'major' ? typeStyle.title1 : size === 'section' ? typeStyle.title3 : typeStyle.caption
  return (
    <RNText accessibilityRole="header" style={[style, { color: ink.ink }]}>
      {children}
    </RNText>
  )
}

function TokenRow({ record }: { record: TokenRecord }) {
  return (
    <View
      testID="token-row"
      nativeID={record.id}
      style={{
        paddingVertical: space['2.5'],
        borderBottomWidth: 1,
        borderBottomColor: line.subtle,
      }}
    >
      <Row gap={space['2']} wrap align="flex-start">
        {colorSwatch(record.resolvedValue)}
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text variant="caption" color={ink.ink}>
            {record.path}
          </Text>
          <Text variant="captionSm" color={ink.muted}>
            {record.resolvedValue}
          </Text>
        </View>
        <Text variant="labelSm" color={record.classification === 'internal' ? ink.muted : ink.ink3}>
          {record.classification}
        </Text>
      </Row>
      <Text variant="captionSm" color={ink.muted} style={{ marginTop: space['1'] }}>
        {record.intendedUse}
      </Text>
    </View>
  )
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const { accent } = useTheme()
  const style = {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingLeft: space['3'],
    paddingRight: space['3'],
    borderRadius: radius.lg,
    borderWidth: selected ? 2 : 1,
    borderStyle: 'solid' as const,
    borderColor: selected ? accent.accent : line.strong,
    backgroundColor: selected ? accent.tint : surface.card,
  }
  const content = (
    <Text variant="caption" color={selected ? accent.accentInk : ink.ink3}>
      {label}
    </Text>
  )

  if (Platform.OS === 'web') {
    return createElement(
      'button',
      {
        type: 'button',
        'aria-label': label,
        'aria-pressed': selected,
        onClick: onPress,
        style,
      },
      content,
    )
  }

  return (
    <RNPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={style}
    >
      {content}
    </RNPressable>
  )
}

function Toggle({
  label,
  checked,
  onPress,
}: {
  label: string
  checked: boolean
  onPress: () => void
}) {
  const { accent } = useTheme()
  const style = {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingLeft: space['3'],
    paddingRight: space['3'],
    borderRadius: radius.lg,
    borderWidth: checked ? 2 : 1,
    borderStyle: 'solid' as const,
    borderColor: checked ? accent.accent : line.strong,
    backgroundColor: checked ? accent.tint : surface.card,
  }
  const content = (
    <Text variant="caption" color={checked ? accent.accentInk : ink.ink3}>
      {label}
    </Text>
  )

  if (Platform.OS === 'web') {
    return createElement(
      'button',
      {
        type: 'button',
        role: 'switch',
        'aria-label': label,
        'aria-checked': checked,
        onClick: onPress,
        style,
      },
      content,
    )
  }

  return (
    <RNPressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={onPress}
      style={style}
    >
      {content}
    </RNPressable>
  )
}

function AccentThemes() {
  const { accentName } = useTheme()
  return (
    <Card>
      <WorkbenchHeading>Accent themes</WorkbenchHeading>
      <Text variant="captionSm" color={ink.muted}>
        Generated together; runtime-selected.
      </Text>
      <Grid style={{ marginTop: space['3'] }}>
        {(Object.entries(accents) as [AccentName, (typeof accents)[AccentName]][]).map(
          ([name, theme]) => {
            const contrast = CONTRAST_REPORT.accentThemes.find((result) => result.name === name)
            return (
              <View key={name} style={{ minWidth: 138, flexGrow: 1 }}>
                <View
                  style={{
                    height: 36,
                    borderRadius: radius.lg,
                    backgroundColor: theme.accent,
                    borderWidth: name === accentName ? 2 : 1,
                    borderColor: name === accentName ? ink.ink : line.strong,
                  }}
                />
                <Text variant="caption" color={theme.accentInk} style={{ marginTop: space['1'] }}>
                  {theme.label}
                </Text>
                <Text variant="captionSm" color={ink.muted}>
                  {contrast === undefined
                    ? 'No accent contrast result'
                    : `${contrast.checked} checked · ${contrast.failed} failed`}
                </Text>
              </View>
            )
          },
        )}
      </Grid>
      <Text
        variant="captionSm"
        color={
          CONTRAST_REPORT.violations.length === 0 ? semantic.success.text : semantic.danger.text
        }
        style={{ marginTop: space['3'] }}
      >
        Live shared report: {CONTRAST_REPORT.passed ? 'passed' : 'failed'} ·{' '}
        {CONTRAST_REPORT.checked} pairings checked · {CONTRAST_REPORT.violations.length} failed.{' '}
        {CONTRAST_REPORT.constraints.join(' · ')}
      </Text>
    </Card>
  )
}

// a11y-lang: PhraseRow owns the Spanish Text node and always applies lang="es" to it.
const GALLERY_SPANISH = '¿Tienen una mesa para dos?'

function StateLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="labelSm" color={ink.muted}>
      {children}
    </Text>
  )
}

function RenderedStateGallery({ textScale }: { textScale: TextScale }) {
  const { accentName, reducedMotion } = useTheme()
  return (
    <View testID="rendered-state-gallery">
      <Stack gap={space['3']}>
        <View>
          <WorkbenchHeading>Rendered production states</WorkbenchHeading>
          <Text variant="captionSm" color={ink.muted}>
            Actual exports · accent {accentName} · reduced motion {reducedMotion ? 'on' : 'off'} ·
            text scale context {textScale * 100}%
          </Text>
        </View>

        <Card>
          <WorkbenchHeading size="group">Button</WorkbenchHeading>
          <Stack gap={space['2']} style={{ marginTop: space['2'] }}>
            <StateLabel>default</StateLabel>
            <Button label="Production button" onPress={() => undefined} />
            <StateLabel>disabled</StateLabel>
            <Button label="Unavailable action" disabled />
            <StateLabel>loading</StateLabel>
            <Button label="Pending production action" loading />
            <StateLabel>pressed and focused</StateLabel>
            <Button
              label="Pressed and focused production action"
              onPress={() => undefined}
              forcedState="pressed-focused"
            />
            <StateLabel>long copy</StateLabel>
            <Button
              label="A deliberately long production action that must remain readable"
              onPress={() => undefined}
            />
          </Stack>
        </Card>

        <Card>
          <WorkbenchHeading size="group">Chip</WorkbenchHeading>
          <Row wrap style={{ marginTop: space['2'] }}>
            <View>
              <StateLabel>default</StateLabel>
              <Chip label="Default chip" selected={false} onPress={() => undefined} />
            </View>
            <View>
              <StateLabel>selected</StateLabel>
              <Chip label="Selected chip" selected onPress={() => undefined} />
            </View>
          </Row>
        </Card>

        <Card>
          <WorkbenchHeading size="group">EmptyState</WorkbenchHeading>
          <Row wrap align="stretch" style={{ marginTop: space['2'] }}>
            <View style={{ minHeight: 180, minWidth: 220, flex: 1 }}>
              <StateLabel>empty</StateLabel>
              <EmptyState
                title="Nothing here yet"
                body="A real production empty state with developer specimen copy."
                padding={space['3']}
              />
            </View>
            <View style={{ minHeight: 180, minWidth: 220, flex: 1 }}>
              <StateLabel>error</StateLabel>
              <EmptyState
                title="Could not load this section"
                body="A real production error presentation with no fabricated learner data."
                padding={space['3']}
              />
            </View>
          </Row>
        </Card>

        <Card>
          <WorkbenchHeading size="group">PhraseRow</WorkbenchHeading>
          <StateLabel>Spanish</StateLabel>
          <PhraseRow
            targetText={GALLERY_SPANISH}
            translation="Do you have a table for two?"
            emoji="☕"
            onPress={() => undefined}
            accessibilityLabel="Spanish production phrase row"
          />
        </Card>

        <Card>
          <WorkbenchHeading size="group">ProgressBar</WorkbenchHeading>
          <Stack gap={space['2']} style={{ marginTop: space['2'] }}>
            <StateLabel>default</StateLabel>
            <ProgressBar value={0.64} label="Default production progress" />
            <StateLabel>error</StateLabel>
            <ProgressBar
              value={0.36}
              label="Error production progress"
              color={semantic.danger.text}
              track={semantic.danger.bg}
            />
          </Stack>
        </Card>
      </Stack>
    </View>
  )
}

function SpecimenGallery() {
  return (
    <View testID="specimen-gallery">
      <Stack gap={space['3']}>
        <View>
          <WorkbenchHeading>Production registry</WorkbenchHeading>
          <Text variant="captionSm" color={ink.muted}>
            Real exports, never workbench clones.
          </Text>
        </View>
        <Card>
          <Text variant="caption" color={ink.ink}>
            State matrix
          </Text>
          <Grid style={{ marginTop: space['2'] }}>
            {SPECIMEN_STATE_MATRIX.map((state) => (
              <View key={state.id} style={{ minWidth: 130 }}>
                <Text variant="captionSm" color={ink.ink3}>
                  {state.id}
                </Text>
                <Text variant="labelSm" color={ink.muted}>
                  {state.status}
                </Text>
              </View>
            ))}
          </Grid>
        </Card>
        {PRODUCTION_SPECIMENS.map((specimen) => (
          <Card key={specimen.name}>
            <SectionHeader
              label={specimen.name}
              hint={`${specimen.group} · ${specimen.disposition}`}
              variant="caption"
            />
            <Grid style={{ marginVertical: space['2'] }}>
              {specimen.states.map((state) => (
                <Text key={state} variant="labelSm" color={ink.muted}>
                  {state}
                </Text>
              ))}
            </Grid>
            {specimen.render?.()}
            {specimen.contextualNote !== undefined && (
              <Text variant="captionSm" color={ink.muted}>
                {specimen.contextualNote}
              </Text>
            )}
          </Card>
        ))}
      </Stack>
    </View>
  )
}

function PendingNavigation() {
  return (
    <Card>
      <WorkbenchHeading>Navigation</WorkbenchHeading>
      <Text variant="captionSm" color={ink.muted}>
        Production registry status.
      </Text>
      <Stack gap={space['2']} style={{ marginTop: space['3'] }}>
        {PENDING_NAVIGATION_SPECIMENS.map((entry) => (
          <Row key={entry.name} justify="space-between" wrap>
            <Text variant="caption" color={ink.ink}>
              {entry.name}
            </Text>
            <Text variant="labelSm" color={semantic.warn.text}>
              pending plan 81
            </Text>
          </Row>
        ))}
      </Stack>
    </Card>
  )
}

function WorkbenchContent({ textScale }: { textScale: TextScale }) {
  const [query, setQuery] = useState('')
  const records = useMemo(() => searchTokenRecords(query), [query])
  const byGroup = useMemo(
    () =>
      Object.keys(TOKEN_GROUPS).map((group) => ({
        group,
        records: records.filter((record) => record.sourceGroup === group),
      })),
    [records],
  )

  return (
    <ScrollView contentContainerStyle={{ padding: space['4'], gap: space['5'] }}>
      <View>
        <WorkbenchHeading size="major">Design system workbench</WorkbenchHeading>
        <Text variant="caption" color={ink.muted} style={{ marginTop: space['1'] }}>
          Generated values and production components. Developer-only; no learner data or mutations.
        </Text>
      </View>

      <AccentThemes />

      <View testID="workbench-screenshot-specimen">
        <Card>
          <SectionHeader label="Stable production subset" hint="Screenshot baseline" />
          <Stack gap={space['2']} style={{ marginTop: space['3'] }}>
            <Button label="Production button" onPress={() => undefined} />
            <Chip label="Selected chip" selected onPress={() => undefined} />
            <ProgressBar value={0.64} label="Production progress" />
          </Stack>
        </Card>
      </View>

      <RenderedStateGallery textScale={textScale} />

      <View testID="token-section-colour">
        <Card>
          <WorkbenchHeading>Generated tokens</WorkbenchHeading>
          <Text variant="captionSm" color={ink.muted}>
            {records.length} of {GENERATED_TOKEN_RECORDS.length} primitive leaves
          </Text>
          <TextInput
            testID="token-search"
            accessibilityLabel="Search tokens"
            placeholder="Search name, value, group, use, or classification"
            placeholderTextColor={ink.muted}
            value={query}
            onChangeText={setQuery}
            style={{
              minHeight: 44,
              marginTop: space['3'],
              paddingHorizontal: space['3'],
              borderWidth: 1,
              borderColor: line.strong,
              borderRadius: radius.lg,
              color: ink.ink,
              backgroundColor: surface.card,
            }}
          />
          {byGroup.map(({ group, records: groupRecords }) =>
            groupRecords.length === 0 ? null : (
              <View key={group} style={{ marginTop: space['4'] }}>
                <WorkbenchHeading size="group">{group}</WorkbenchHeading>
                <Text variant="captionSm" color={ink.muted}>
                  {TOKEN_GROUPS[group as keyof typeof TOKEN_GROUPS].intendedUse}
                </Text>
                {groupRecords.map((record) => (
                  <TokenRow key={record.path} record={record} />
                ))}
              </View>
            ),
          )}
        </Card>
      </View>

      <View
        testID="text-scale-context"
        accessibilityLabel={`Text scale inspection context: ${textScale * 100}%`}
      >
        <Text variant="captionSm" color={ink.muted}>
          Text scale context: {textScale * 100}% · production ThemeProvider scales text while layout
          boxes remain fixed.
        </Text>
      </View>
      <SpecimenGallery />
      <PendingNavigation />
    </ScrollView>
  )
}

/**
 * The route-level workbench implementation. All controls are ephemeral inspection context; they
 * never write learner settings. Text scale uses the production theme seam and changes text metrics
 * without applying a transform or zoom to layout boxes.
 */
export function Workbench() {
  const [accent, setAccent] = useState<AccentName>('coral')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [textScale, setTextScale] = useState<TextScale>(1)
  const [device, setDevice] = useState<DevicePreset>(AUTHORED_DEVICE)
  const [safeAreaEnabled, setSafeAreaEnabled] = useState(false)
  const safeArea: SafeAreaPreset = safeAreaEnabled ? 'home-indicator' : 'none'
  const safePadding = {
    none: { paddingTop: 0, paddingBottom: 0 },
    notch: { paddingTop: 44, paddingBottom: 0 },
    'home-indicator': { paddingTop: 0, paddingBottom: 34 },
  }[safeArea]

  return (
    <ThemeProvider accent={accent} reducedMotion={reducedMotion} textScale={textScale}>
      <ScrollView style={{ flex: 1, backgroundColor: surface.canvas }}>
        <Stack gap={space['3']} style={{ padding: space['4'] }}>
          <Card>
            <SectionHeader label="Inspection context" hint="Ephemeral developer controls" />
            <View role="group" accessibilityLabel="Accent theme" style={{ marginTop: space['2'] }}>
              <Text variant="captionSm" color={ink.muted}>
                Accent theme
              </Text>
              <Grid style={{ marginTop: space['1'] }}>
                {(Object.keys(accents) as AccentName[]).map((name) => (
                  <OptionButton
                    key={name}
                    label={accents[name].label}
                    selected={accent === name}
                    onPress={() => {
                      setAccent(name)
                    }}
                  />
                ))}
              </Grid>
            </View>
            <Row wrap style={{ marginTop: space['3'] }}>
              <Toggle
                label="Reduced motion"
                checked={reducedMotion}
                onPress={() => {
                  setReducedMotion((value) => !value)
                }}
              />
              <Toggle
                label="Safe area"
                checked={safeAreaEnabled}
                onPress={() => {
                  setSafeAreaEnabled((value) => !value)
                }}
              />
            </Row>
            <View role="group" accessibilityLabel="Text scale" style={{ marginTop: space['3'] }}>
              <Text variant="captionSm" color={ink.muted}>
                Text scale
              </Text>
              <Grid style={{ marginTop: space['1'] }}>
                {TEXT_SCALES.map((option) => (
                  <OptionButton
                    key={option.value}
                    label={option.label}
                    selected={textScale === option.value}
                    onPress={() => {
                      setTextScale(option.value)
                    }}
                  />
                ))}
              </Grid>
            </View>
            <View role="group" accessibilityLabel="Device size" style={{ marginTop: space['3'] }}>
              <Text variant="captionSm" color={ink.muted}>
                Device size
              </Text>
              <Grid style={{ marginTop: space['1'] }}>
                {DEVICE_PRESETS.map((preset) => (
                  <OptionButton
                    key={preset.id}
                    label={preset.label}
                    selected={device.id === preset.id}
                    onPress={() => {
                      setDevice(preset)
                    }}
                  />
                ))}
              </Grid>
            </View>
          </Card>

          <ScrollView
            horizontal
            testID="workbench-device-scroll"
            contentContainerStyle={{ paddingHorizontal: space['2'], alignItems: 'flex-start' }}
          >
            <View
              testID="workbench-viewport"
              accessibilityLabel={`${device.label}; safe area ${safeArea}`}
              style={{
                width: device.width,
                height: device.height,
                maxHeight: 1024,
                overflow: 'hidden',
                borderRadius: radius.screen,
                borderWidth: 1,
                borderColor: line.strongest,
                backgroundColor: surface.app,
                ...safePadding,
              }}
            >
              <WorkbenchContent textScale={textScale} />
            </View>
          </ScrollView>
        </Stack>
      </ScrollView>
    </ThemeProvider>
  )
}
