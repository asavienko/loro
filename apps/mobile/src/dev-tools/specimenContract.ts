export const PRODUCTION_COMPONENT_NAMES = [
  'Text',
  'SectionLabel',
  'ChartSummary',
  'SectionHeader',
  'CardHeader',
  'Pressable',
  'Screen',
  'Card',
  'DarkCard',
  'Divider',
  'Row',
  'Stack',
  'Grid',
  'Button',
  'IconButton',
  'Pill',
  'Chip',
  'Segmented',
  'Sheet',
  'ProgressBar',
  'Dots',
  'EmojiTile',
  'Dot',
  'StatTile',
  'Field',
  'ActionBar',
  'DifficultySelector',
  'EmptyState',
  'PhraseRow',
  'StatRow',
  'TagChips',
  'AudioControls',
  'LanguageChoices',
  'NavigationMenu',
] as const

export type RegisteredProductionComponentName = (typeof PRODUCTION_COMPONENT_NAMES)[number]

export type SpecimenState =
  | 'default'
  | 'pressed-focused'
  | 'disabled'
  | 'loading'
  | 'empty'
  | 'error'
  | 'selected'
  | 'long-copy'
  | 'spanish'
  | 'text-200'
  | 'text-310'
  | 'reduced-motion'
  | 'accent'

export const SPECIMEN_STATE_MATRIX = [
  { id: 'default', status: 'available' },
  { id: 'pressed-focused', status: 'available' },
  { id: 'disabled', status: 'available' },
  { id: 'loading', status: 'available' },
  { id: 'empty', status: 'available' },
  { id: 'error', status: 'available' },
  { id: 'selected', status: 'available' },
  { id: 'long-copy', status: 'available' },
  { id: 'spanish', status: 'available' },
  { id: 'text-200', status: 'inspection-context' },
  { id: 'text-310', status: 'inspection-context' },
  { id: 'reduced-motion', status: 'inspection-context' },
  { id: 'accent', status: 'inspection-context' },
] as const satisfies readonly {
  readonly id: SpecimenState
  readonly status: 'available' | 'interactive' | 'inspection-context'
}[]

export const PLAN_80_PENDING_NAVIGATION = [
  'Spine',
  'ScreenHeader',
  'SwitcherSheet',
  'ExitSheet',
  'ResumeStrip',
  'TransportStrip',
] as const

export interface PendingNavigationSpecimen {
  readonly name: (typeof PLAN_80_PENDING_NAVIGATION)[number]
  readonly status: 'pending-plan-81'
  readonly reason: string
}

export const PENDING_NAVIGATION_SPECIMENS: readonly PendingNavigationSpecimen[] =
  PLAN_80_PENDING_NAVIGATION.map((name) => ({
    name,
    status: 'pending-plan-81',
    reason:
      name === 'Spine'
        ? 'The current spine is rendered as NavigationMenu; a separate Spine API remains pending plan 81.'
        : 'This named API remains pending plan 81; the workbench does not draw a lookalike.',
  }))
