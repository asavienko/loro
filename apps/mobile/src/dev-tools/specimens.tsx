import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import * as componentExports from '../ui/components'
import * as primitiveExports from '../ui/primitives'
import { onDark, semantic, space } from '../ui/theme'
import {
  PENDING_NAVIGATION_SPECIMENS,
  PLAN_80_PENDING_NAVIGATION,
  PRODUCTION_COMPONENT_NAMES,
  SPECIMEN_STATE_MATRIX,
  type PendingNavigationSpecimen,
  type RegisteredProductionComponentName,
  type SpecimenState,
} from './specimenContract'

export {
  PENDING_NAVIGATION_SPECIMENS,
  PLAN_80_PENDING_NAVIGATION,
  PRODUCTION_COMPONENT_NAMES,
  SPECIMEN_STATE_MATRIX,
  type PendingNavigationSpecimen,
  type SpecimenState,
}

export const PRODUCTION_COMPONENTS = {
  ...primitiveExports,
  ...componentExports,
}

export type ProductionComponentName = keyof typeof PRODUCTION_COMPONENTS
type ComponentNameContract = RegisteredProductionComponentName extends ProductionComponentName
  ? ProductionComponentName extends RegisteredProductionComponentName
    ? true
    : never
  : never
const COMPONENT_NAME_CONTRACT: ComponentNameContract = true
void COMPONENT_NAME_CONTRACT
export type ProductionComponentReference = (typeof PRODUCTION_COMPONENTS)[ProductionComponentName]

export interface ProductionSpecimen {
  readonly name: ProductionComponentName
  readonly component: ProductionComponentReference
  readonly disposition: 'rendered' | 'interaction-owned'
  readonly group: 'primitive' | 'component'
  readonly states: readonly SpecimenState[]
  readonly render?: (() => ReactNode) | undefined
  readonly contextualNote?: string | undefined
}

interface SpecimenMetadata {
  readonly states: readonly SpecimenState[]
  readonly render?: (() => ReactNode) | undefined
  readonly contextualNote?: string | undefined
}

const noop = (): void => undefined

const SAMPLE_STATS = [
  { value: '12', label: 'phrases' },
  { value: '3', label: 'reps' },
  { value: '2', label: 'days' },
] as const
// a11y-lang: PhraseRow owns the Spanish Text node and always applies lang="es" to it.
const SAMPLE_SPANISH = '¿Tienen una mesa para dos?'

const PRIMITIVE_METADATA = {
  Text: {
    states: ['default', 'long-copy', 'spanish', 'text-200', 'text-310', 'accent'],
    render: () => <primitiveExports.Text>Production text specimen</primitiveExports.Text>,
  },
  SectionLabel: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => <primitiveExports.SectionLabel>Section label</primitiveExports.SectionLabel>,
  },
  ChartSummary: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.ChartSummary>
        Visible summary for a production chart.
      </primitiveExports.ChartSummary>
    ),
  },
  SectionHeader: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => <primitiveExports.SectionHeader label="Section" hint="Production hint" />,
  },
  CardHeader: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => <primitiveExports.CardHeader title="Card title" meta="12 total" />,
  },
  Pressable: {
    states: ['default', 'pressed-focused', 'disabled', 'selected', 'reduced-motion', 'accent'],
    render: () => (
      <primitiveExports.Pressable onPress={noop} accessibilityLabel="Production pressable">
        <primitiveExports.Text>Focus or press this production control</primitiveExports.Text>
      </primitiveExports.Pressable>
    ),
  },
  Screen: {
    states: ['default', 'text-200', 'text-310', 'accent'],
    render: () => (
      <primitiveExports.Screen>
        <primitiveExports.Text>Screen surface</primitiveExports.Text>
      </primitiveExports.Screen>
    ),
  },
  Card: {
    states: ['default', 'long-copy', 'text-200', 'text-310', 'accent'],
    render: () => (
      <primitiveExports.Card>
        <primitiveExports.Text>Production card</primitiveExports.Text>
      </primitiveExports.Card>
    ),
  },
  DarkCard: {
    states: ['default', 'long-copy', 'text-200', 'text-310', 'accent'],
    render: () => (
      <primitiveExports.DarkCard>
        <primitiveExports.Text color={onDark.primary}>Dark stage specimen</primitiveExports.Text>
      </primitiveExports.DarkCard>
    ),
  },
  Divider: { states: ['default'], render: () => <primitiveExports.Divider /> },
  Row: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.Row wrap>
        <primitiveExports.Text>First</primitiveExports.Text>
        <primitiveExports.Text>Second</primitiveExports.Text>
      </primitiveExports.Row>
    ),
  },
  Stack: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.Stack>
        <primitiveExports.Text>First</primitiveExports.Text>
        <primitiveExports.Text>Second</primitiveExports.Text>
      </primitiveExports.Stack>
    ),
  },
  Grid: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.Grid>
        <primitiveExports.Pill label="First" />
        <primitiveExports.Pill label="Second" />
      </primitiveExports.Grid>
    ),
  },
  Button: {
    states: [
      'default',
      'pressed-focused',
      'disabled',
      'loading',
      'long-copy',
      'text-200',
      'text-310',
      'reduced-motion',
      'accent',
    ],
    render: () => <primitiveExports.Button label="Production button" onPress={noop} />,
  },
  IconButton: {
    states: ['default', 'pressed-focused', 'disabled', 'reduced-motion', 'accent'],
    render: () => <primitiveExports.IconButton glyph="♪" label="Production icon" onPress={noop} />,
  },
  Pill: {
    states: ['default', 'selected', 'long-copy', 'text-200', 'text-310', 'accent'],
    render: () => <primitiveExports.Pill label="Production pill" tone="accent" />,
  },
  Chip: {
    states: [
      'default',
      'pressed-focused',
      'selected',
      'long-copy',
      'text-200',
      'text-310',
      'reduced-motion',
      'accent',
    ],
    render: () => <primitiveExports.Chip label="Selected chip" selected onPress={noop} />,
  },
  Segmented: {
    states: [
      'default',
      'pressed-focused',
      'selected',
      'long-copy',
      'text-200',
      'text-310',
      'reduced-motion',
      'accent',
    ],
    render: () => (
      <primitiveExports.Segmented
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ]}
        value="one"
        onChange={noop}
      />
    ),
  },
  Sheet: {
    states: ['default', 'pressed-focused', 'reduced-motion', 'accent'],
    contextualNote: 'Rendered by its owning interaction because a modal cannot be embedded inline.',
  },
  ProgressBar: {
    states: ['default', 'error', 'reduced-motion', 'accent'],
    render: () => <primitiveExports.ProgressBar value={0.64} label="Production progress" />,
  },
  Dots: {
    states: ['default', 'selected', 'accent'],
    render: () => <primitiveExports.Dots count={5} filled={3} />,
  },
  EmojiTile: {
    states: ['default'],
    render: () => <primitiveExports.EmojiTile emoji="🦜" />,
  },
  Dot: {
    states: ['default', 'error'],
    render: () => <primitiveExports.Dot size={9} color={semantic.danger.text} />,
  },
  StatTile: {
    states: ['default', 'empty', 'long-copy', 'text-200', 'text-310'],
    render: () => <primitiveExports.StatTile value="12" label="phrases" />,
  },
  Field: {
    states: ['default', 'disabled', 'error', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.Field
        bordered
        accessibilityLabel="Production field"
        value="Search tokens"
        onChangeText={noop}
      />
    ),
  },
  ListRow: {
    states: ['default', 'selected', 'disabled', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <primitiveExports.ListRow
        accessibilityLabel="Production list row"
        gap={space['2.5']}
        onPress={noop}
      >
        <primitiveExports.Text>Production list row</primitiveExports.Text>
      </primitiveExports.ListRow>
    ),
  },
} as const satisfies Record<keyof typeof primitiveExports, SpecimenMetadata>

function LanguageChoicesSpecimen() {
  const [selected, setSelected] = useState<'en' | 'bg' | 'ru'>('bg')
  return (
    <componentExports.LanguageChoices
      title="Workbench language choices"
      values={['en', 'bg', 'ru']}
      selected={selected}
      onSelect={setSelected}
    />
  )
}

const COMPONENT_METADATA = {
  ActionBar: {
    states: ['default', 'long-copy', 'text-200', 'text-310'],
    contextualNote: 'Rendered by its owning screen because it is an absolute safe-area host.',
  },
  DifficultySelector: {
    states: ['default', 'selected', 'long-copy', 'text-200', 'text-310', 'accent'],
    contextualNote: 'Rendered with domain-owned labels by its learner route.',
  },
  EmptyState: {
    states: ['empty', 'error', 'long-copy', 'text-200', 'text-310'],
    render: () => (
      <View style={{ minHeight: 180 }}>
        <componentExports.EmptyState
          title="Production empty state"
          body="The same component learner routes use, with developer-only specimen copy."
          padding={space['3']}
        />
      </View>
    ),
  },
  PhraseRow: {
    states: ['default', 'pressed-focused', 'long-copy', 'spanish', 'text-200', 'text-310'],
    render: () => (
      <componentExports.PhraseRow
        targetText={SAMPLE_SPANISH}
        translation="Do you have a table for two?"
        emoji="☕"
        onPress={noop}
        accessibilityLabel="Production phrase row"
      />
    ),
  },
  StatRow: {
    states: ['default', 'empty', 'long-copy', 'text-200', 'text-310'],
    render: () => <componentExports.StatRow stats={SAMPLE_STATS} />,
  },
  TagChips: {
    states: [
      'default',
      'pressed-focused',
      'selected',
      'long-copy',
      'text-200',
      'text-310',
      'accent',
    ],
    contextualNote: 'Rendered with the owning route’s exhaustive domain tag labels.',
  },
  AudioControls: {
    states: ['disabled'],
    render: () => (
      <componentExports.AudioControls
        label="Unavailable specimen audio"
        note="No device audio in this specimen."
        enabled={false}
        onPress={noop}
      />
    ),
  },
  LanguageChoices: {
    states: ['default', 'selected', 'text-200', 'text-310'],
    render: () => <LanguageChoicesSpecimen />,
  },
  NavigationMenu: {
    states: ['default', 'selected', 'text-200', 'text-310'],
    render: () => (
      <componentExports.NavigationMenu
        place="Workbench"
        openLabel="Open specimen navigation"
        title="Specimen navigation"
        groupLabel="Destinations"
        dismissLabel="Close specimen navigation"
        hereLabel="You are here"
        reveal="⌄"
        chevron="›"
        destinations={[
          {
            label: 'Workbench',
            current: true,
            currentLabel: 'Workbench, current destination',
            onPress: noop,
          },
          {
            label: 'Example destination',
            current: false,
            currentLabel: 'Example destination',
            onPress: noop,
          },
        ]}
      />
    ),
  },
} as const satisfies Record<keyof typeof componentExports, SpecimenMetadata>

export const PRODUCTION_SPECIMENS: readonly ProductionSpecimen[] = [
  ...(Object.keys(PRIMITIVE_METADATA) as (keyof typeof primitiveExports)[]).map((name) => ({
    name,
    component: primitiveExports[name],
    group: 'primitive' as const,
    disposition:
      'render' in PRIMITIVE_METADATA[name] ? ('rendered' as const) : ('interaction-owned' as const),
    ...PRIMITIVE_METADATA[name],
  })),
  ...(Object.keys(COMPONENT_METADATA) as (keyof typeof componentExports)[]).map((name) => ({
    name,
    component: componentExports[name],
    group: 'component' as const,
    disposition:
      'render' in COMPONENT_METADATA[name] ? ('rendered' as const) : ('interaction-owned' as const),
    ...COMPONENT_METADATA[name],
  })),
]

// Kept as a runtime assertion too: unusual transpilation or barrel behavior must not produce a
// registry that differs from the dependency-free contract unit tests can load in Node.
if (
  PRODUCTION_SPECIMENS.map((entry) => entry.name).join('|') !== PRODUCTION_COMPONENT_NAMES.join('|')
) {
  throw new Error('production specimen registry differs from its public component contract')
}
