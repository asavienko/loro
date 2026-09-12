/**
 * Authoring generate queue (plan 101). Coverage + connectivity; no learner state.
 *
 * Reports only. Phrase gaps become plan-97 drafts. Audio gaps enqueue plans 98/99.
 * Never merges into the bundled catalog and never opens a TTS client.
 */
import { audioCheck, packCountCheck, scenarioShapeCheck, type Issue } from './checks.js'
import { stubPhraseDraft, type PhraseAuthoringDraft } from './phraseDrafts.js'
import type { Catalog } from './types.js'

function issueId(issue: Issue): string | undefined {
  return issue.id
}

export const AUDIO_QUEUE_REFERENCE = 'as-01'
export const AUDIO_QUEUE_LISTENING = 'as-07'

export interface GapPriorityReport {
  orphans: string[]
  thinScenarios: { id: string; count: number }[]
  shortPacks: { id: string; actual: number; target: number }[]
  missingAudio: {
    id: string
    enqueue: readonly [typeof AUDIO_QUEUE_REFERENCE, typeof AUDIO_QUEUE_LISTENING]
  }[]
  drafts: PhraseAuthoringDraft[]
}

function scenarioNextEnds(catalog: Catalog): Set<string> {
  const connected = new Set<string>()
  for (const edge of catalog.graph.edges) {
    if (edge.relation !== 'scenario_next') continue
    connected.add(edge.from)
    connected.add(edge.to)
  }
  return connected
}

/** Deterministic coverage report for the generate queue. */
export function gapPriority(
  catalog: Catalog,
  options: { emitDrafts?: boolean } = {},
): GapPriorityReport {
  const connected = scenarioNextEnds(catalog)
  const orphans = catalog.phrases
    .filter((phrase) => !connected.has(phrase.id))
    .map((phrase) => phrase.id)
    .sort()

  const thinScenarios = scenarioShapeCheck(catalog)
    .filter((issue) => issue.level === 'warn')
    .flatMap((issue) => {
      const id = issueId(issue)
      if (id === undefined) return []
      const scenario = catalog.scenarios.find((row) => row.id === id)
      return [{ id, count: scenario?.phrases.length ?? 0 }]
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const shortPacks = packCountCheck(catalog)
    .filter(
      (issue) =>
        issue.level === 'warn' && issue.message.includes('/') && !issue.message.startsWith('draft'),
    )
    .flatMap((issue) => {
      const id = issueId(issue)
      if (id === undefined) return []
      const pack = catalog.packs.find((row) => row.id === id)
      return [
        {
          id,
          actual: pack?.phrases.length ?? 0,
          target: pack?.targetCount ?? 0,
        },
      ]
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const missingAudio = audioCheck(catalog)
    .filter((issue) => issue.level === 'warn')
    .flatMap((issue) => {
      const id = issueId(issue)
      if (id === undefined) return []
      return [
        {
          id,
          enqueue: [AUDIO_QUEUE_REFERENCE, AUDIO_QUEUE_LISTENING] as const,
        },
      ]
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const drafts: PhraseAuthoringDraft[] = []
  if (options.emitDrafts === true) {
    for (const id of orphans) {
      drafts.push(
        stubPhraseDraft({
          topic: `orphan:${id}`,
          target_locale: 'es-ES',
          native_language: 'en',
        }),
      )
    }
    for (const scenario of thinScenarios) {
      drafts.push(
        stubPhraseDraft({
          topic: `scenario:${scenario.id}`,
          target_locale: 'es-ES',
          native_language: 'en',
        }),
      )
    }
    for (const pack of shortPacks) {
      drafts.push(
        stubPhraseDraft({
          topic: `pack:${pack.id}`,
          target_locale: 'es-ES',
          native_language: 'en',
        }),
      )
    }
  }

  return { orphans, thinScenarios, shortPacks, missingAudio, drafts }
}
