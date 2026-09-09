import { join } from 'node:path'
import {
  failedManifest,
  finalizeManifest,
  formatSummary,
  pngProblem,
  readManifest,
  validatePassedStates,
  writeManifest,
} from './screenshots-artifacts.mjs'

export default class ScreenshotReporter {
  constructor({ runDir }) {
    this.runDir = runDir
    this.errors = []
  }

  onTestEnd(test, result) {
    const prefix = 'capture: '
    if (!test.title.startsWith(prefix)) return
    const name = test.title.slice(prefix.length)
    const manifest = readManifest(this.runDir)
    const entry = manifest.states.find((state) => state.name === name)
    if (entry === undefined) return

    entry.status = result.status === 'passed' ? 'passed' : 'failed'
    if (result.status === 'passed') {
      const problem = pngProblem(join(this.runDir, entry.image))
      if (problem !== undefined) {
        entry.status = 'failed'
        entry.error = problem
      }
    } else if (result.errors.length > 0) {
      entry.error = result.errors.map((error) => error.message ?? String(error)).join('\n\n')
    } else {
      entry.error = `Capture finished with status: ${result.status}.`
    }
    writeManifest(this.runDir, manifest)
  }

  onError(error) {
    this.errors.push(error.message ?? String(error))
  }

  onEnd(result) {
    let manifest
    try {
      manifest = readManifest(this.runDir)
    } catch (error) {
      manifest = failedManifest(
        `The capture manifest could not be read: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (this.errors.length > 0)
      manifest.error = [manifest.error, ...this.errors].filter(Boolean).join('\n\n')
    validatePassedStates(this.runDir, manifest)

    if (result.status !== 'passed')
      manifest.error = [manifest.error, `Playwright finished with status: ${result.status}.`]
        .filter(Boolean)
        .join('\n\n')
    const counts = manifest.states.reduce(
      (totals, state) => ({ ...totals, [state.status]: totals[state.status] + 1 }),
      { passed: 0, failed: 0, 'not-run': 0 },
    )
    manifest.status =
      manifest.error === undefined && counts.failed === 0 && counts['not-run'] === 0
        ? 'passed'
        : 'failed'
    manifest.counts = counts
    finalizeManifest(this.runDir, manifest)
    console.log(formatSummary(this.runDir, manifest))
    return manifest.status === 'passed' ? undefined : { status: 'failed' }
  }
}
