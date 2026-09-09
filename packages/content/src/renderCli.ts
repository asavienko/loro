/**
 * `pnpm content:render`
 *
 * Loads SOPS/runtime env itself. Does not inherit the API container environment.
 * Stub and failed renders cannot publish. Live ElevenLabs is opt-in and outside CI.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCatalogFromDisk, contentRoot } from './fs.js'
import {
  assertPublishable,
  renderCatalog,
  type RenderRequest,
  type SynthesizeResult,
} from './render.js'

interface RenderTransport {
  ElevenLabsTts: new (options: {
    apiKey: string
    model: string
    outputFormat: string
    timeoutMs: number
    maxRequestBytes: number
    maxResponseBytes: number
    maxConcurrentRequests: number
  }) => { synthesize: (input: RenderRequest) => Promise<SynthesizeResult> }
  StubTts: new () => { synthesize: (input: RenderRequest) => Promise<SynthesizeResult> }
  parseTtsConfig: (env: NodeJS.Dict<string>) => {
    provider: 'stub' | 'elevenlabs'
    apiKey: string
    model: string
    outputFormat: string
    voices: Readonly<Record<string, string>>
  }
  voiceForLocale: (voices: Readonly<Record<string, string>>, locale: string) => string
}

function arg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

async function loadTransport(): Promise<RenderTransport> {
  const url = new URL('../../../apps/api/src/integrations/elevenlabs/tts.ts', import.meta.url)
  return import(url.href) as Promise<RenderTransport>
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const idsRaw = arg(argv, '--ids')
  const ids = idsRaw === undefined ? undefined : idsRaw.split(',').filter(Boolean)
  if (!argv.includes('--all') && ids === undefined && !dryRun) {
    console.error('content:render: pass --ids cafe1,cafe2 or --all')
    process.exit(2)
  }
  const ceiling = Number.parseInt(arg(argv, '--ceiling') ?? '5000', 10)
  if (!Number.isSafeInteger(ceiling) || ceiling < 0) {
    console.error('content:render: --ceiling must be a non-negative integer')
    process.exit(2)
  }
  const { ElevenLabsTts, StubTts, parseTtsConfig, voiceForLocale } = await loadTransport()
  let config
  try {
    config = parseTtsConfig(process.env)
  } catch {
    console.error('content:render: TTS configuration is incomplete or unknown')
    process.exit(2)
    return
  }
  const catalog = loadCatalogFromDisk()
  const outputDir = join(contentRoot, '.render-cache')
  const selection = ids === undefined ? {} : { ids }
  if (dryRun) {
    const report = await renderCatalog(catalog, (input) => new StubTts().synthesize(input), {
      ...selection,
      dryRun: true,
      creditCeiling: ceiling,
      locale: 'es-ES',
      voiceId: config.voices['es-ES'] ?? 'unconfigured',
      outputDir,
    })
    console.log(
      `content:render dry-run ${report.attempted} phrases · ${report.estimatedCharacters} characters (estimate, not billed)`,
    )
    return
  }
  if (config.provider !== 'elevenlabs') {
    console.error('content:render: TTS_PROVIDER=stub cannot publish catalog audio')
    process.exit(1)
  }
  let voiceId: string
  try {
    voiceId = voiceForLocale(config.voices, 'es-ES')
  } catch {
    console.error('content:render: TTS_VOICE_ES_ES is required')
    process.exit(2)
    return
  }
  const client = new ElevenLabsTts({
    apiKey: config.apiKey,
    model: config.model,
    outputFormat: config.outputFormat,
    timeoutMs: 20_000,
    maxRequestBytes: 16_384,
    maxResponseBytes: 2_000_000,
    maxConcurrentRequests: 2,
  })
  const report = await renderCatalog(catalog, (input) => client.synthesize(input), {
    ...selection,
    dryRun: false,
    creditCeiling: ceiling,
    locale: 'es-ES',
    voiceId,
    outputDir,
  })
  console.log(
    `content:render attempted=${report.attempted} rendered=${report.rendered} skipped=${report.skipped} failed=${report.failed}`,
  )
  for (const error of report.errors) {
    console.error(`  ${error.id}: ${error.code}`)
  }
  try {
    assertPublishable(report, config.provider)
  } catch (error) {
    console.error(`content:render: ${error instanceof Error ? error.message : 'unpublished'}`)
    process.exit(1)
  }
  const phrasesPath = join(contentRoot, catalog.lang, 'phrases.json')
  const existing = JSON.parse(await readFile(phrasesPath, 'utf8')) as {
    phrases: unknown[]
  } & Record<string, unknown>
  existing.phrases = report.phrases
  await writeFile(phrasesPath, `${JSON.stringify(existing, null, 2)}\n`)
}

main().catch(() => {
  console.error('content:render: unavailable')
  process.exit(1)
})
