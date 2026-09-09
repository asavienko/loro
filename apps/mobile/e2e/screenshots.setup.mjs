import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureRunDirectory,
  failedManifest,
  initialManifest,
  readManifest,
  writeManifest,
} from './screenshots-artifacts.mjs'

export default function setup(config) {
  const runDir = config.metadata.screenshotRunDir
  const directory = dirname(fileURLToPath(import.meta.url))
  const repository = resolve(directory, '../../..')
  ensureRunDirectory(runDir)

  // The launcher normally creates this before Playwright starts its web server. Preserve it if
  // setup itself fails so a failed run still describes every expected state.
  let existing
  try {
    existing = readManifest(runDir)
  } catch {
    // A direct Playwright invocation has no launcher-created manifest yet. The initial manifest
    // below is the source of truth in that case; only preserve a manifest when one was readable.
  }
  try {
    writeManifest(runDir, initialManifest(repository))
  } catch (error) {
    writeManifest(
      runDir,
      failedManifest(error instanceof Error ? error.message : String(error), existing),
    )
    throw error
  }
}
