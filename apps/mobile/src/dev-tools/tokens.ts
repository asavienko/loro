import { tokens as generatedTokens } from '@loro/design-tokens'

export type GeneratedTokenGroup = keyof typeof generatedTokens
export type TokenClassification = 'visual' | 'internal'
export type TokenValue = string | number | boolean | null

export interface TokenRecord {
  readonly id: string
  readonly path: string
  readonly sourceGroup: GeneratedTokenGroup
  readonly value: TokenValue
  readonly resolvedValue: string
  readonly classification: TokenClassification
  readonly intendedUse: string
}

interface GroupMetadata {
  readonly intendedUse: string
}

/**
 * One exhaustive description per generated export group. A new top-level token export cannot
 * silently miss the workbench: `satisfies` makes it a type error, while the unit test below proves
 * every primitive leaf is represented by a searchable row.
 */
export const TOKEN_GROUPS = {
  surface: { intendedUse: 'Screen, card, well, scrim, device, and dark-stage surfaces.' },
  ink: { intendedUse: 'Text and glyph hierarchy on light surfaces.' },
  line: { intendedUse: 'Hairlines, borders, dividers, and selection weight.' },
  semantic: { intendedUse: 'Success, warning, danger, information, and teaching states.' },
  scale: { intendedUse: 'Ordered mastery, ladder, confidence, and warming signals.' },
  onDark: { intendedUse: 'Text, marks, layers, and lines on dark stages.' },
  gradient: { intendedUse: 'Authored gradients awaiting or using a reviewed native mapping.' },
  accents: { intendedUse: 'Whole-product accent themes and their accessible variants.' },
  defaultAccent: { intendedUse: 'Generated default for the runtime accent theme.' },
  space: { intendedUse: 'Shared spacing scale.' },
  gutter: { intendedUse: 'Dense, default, and roomy screen gutters.' },
  radius: { intendedUse: 'Shared corners, pills, sheets, screens, and device chrome.' },
  shadow: { intendedUse: 'Authored depth values awaiting or using a reviewed native mapping.' },
  size: { intendedUse: 'Cross-platform reusable control and visualization geometry.' },
  typography: { intendedUse: 'Font families, type metrics, and typography rules.' },
  motion: {
    intendedUse: 'Easing, animation, transitions, press feedback, audio timing, and touch.',
  },
} as const satisfies Record<GeneratedTokenGroup, GroupMetadata>

const INTERNAL_PATH_PARTS = new Set([
  'constraint',
  'deviation',
  'label',
  'note',
  'range',
  'rules',
  'textSizeFloor',
  'use',
])

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function tokenId(path: string): string {
  return `dev-token-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
}

function resolvedValue(value: TokenValue): string {
  if (typeof value === 'string') return value
  if (value === null) return 'null'
  return String(value)
}

function classificationFor(path: readonly string[]): TokenClassification {
  return path.some((part) => INTERNAL_PATH_PARTS.has(part)) ? 'internal' : 'visual'
}

function collectLeaves(
  value: unknown,
  path: readonly string[],
  sourceGroup: GeneratedTokenGroup,
  rows: TokenRecord[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLeaves(item, [...path, String(index)], sourceGroup, rows)
    })
    return
  }

  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectLeaves(child, [...path, key], sourceGroup, rows)
    }
    return
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean' &&
    value !== null
  ) {
    throw new Error(`unsupported generated token value at ${path.join('.')}`)
  }

  const semanticPath = path.join('.')
  rows.push({
    id: tokenId(semanticPath),
    path: semanticPath,
    sourceGroup,
    value,
    resolvedValue: resolvedValue(value),
    classification: classificationFor(path),
    intendedUse: TOKEN_GROUPS[sourceGroup].intendedUse,
  })
}

/** Flatten the generated runtime export without copying any token value into workbench code. */
export function flattenGeneratedTokens(
  source: typeof generatedTokens = generatedTokens,
): readonly TokenRecord[] {
  const rows: TokenRecord[] = []
  for (const sourceGroup of Object.keys(TOKEN_GROUPS) as GeneratedTokenGroup[]) {
    collectLeaves(source[sourceGroup], [sourceGroup], sourceGroup, rows)
  }
  return rows
}

export const GENERATED_TOKEN_RECORDS = flattenGeneratedTokens()

export function searchTokenRecords(
  query: string,
  records: readonly TokenRecord[] = GENERATED_TOKEN_RECORDS,
): readonly TokenRecord[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized.length === 0) return records
  return records.filter((record) =>
    [
      record.path,
      record.sourceGroup,
      record.resolvedValue,
      record.classification,
      record.intendedUse,
    ].some((candidate) => candidate.toLocaleLowerCase().includes(normalized)),
  )
}
