import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, onboard, test } from './fixtures'
import { enter } from './helpers'
import { prepareScreenCapture, serializeScreenHtml } from './screenshots-serialize-html'
import { STATES } from './states'

const runDir = process.env.LORO_SCREENSHOT_RUN_DIR
if (runDir === undefined) throw new Error('LORO_SCREENSHOT_RUN_DIR was not configured.')

const FIXED_TIME = '2026-09-09T08:00:00.000Z'

interface CaptureManifestState {
  name: string
  image: string
  html: string
}

interface CaptureManifest {
  run: {
    browser: {
      name: string | null
      version: string | null
    }
  }
  states: CaptureManifestState[]
}

const artifactPaths = new Map<string, { image: string; html: string }>()

test.beforeAll(({ browser }) => {
  const manifestPath = join(runDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CaptureManifest
  manifest.run.browser = {
    name: browser.browserType().name(),
    version: browser.version(),
  }
  for (const state of manifest.states) {
    artifactPaths.set(state.name, { image: state.image, html: state.html })
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
})

for (const state of STATES) {
  test(`capture: ${state.name}`, async ({ page }) => {
    // Keep the visual date and time repeatable without freezing app timers such as toasts.
    await page.clock.setFixedTime(FIXED_TIME)
    await enter(page, state, onboard)
    await page.evaluate(prepareScreenCapture)

    const toast = page.locator('[role="alert"][aria-live="polite"]')
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    const preservesUndo = state.name === 'today · remove undo offered'
    if (preservesUndo) await expect(undo).toBeVisible()
    else await expect(toast).toBeHidden()

    const paths = artifactPaths.get(state.name)
    if (paths === undefined) throw new Error(`No capture manifest entry for ${state.name}.`)
    const image = join(runDir, paths.image)
    const html = join(runDir, paths.html)
    mkdirSync(join(runDir, 'images'), { recursive: true })
    mkdirSync(join(runDir, 'html'), { recursive: true })
    await page.screenshot({ path: image, animations: 'disabled', caret: 'hide' })
    writeFileSync(html, await page.evaluate(serializeScreenHtml))

    // This state exists to capture the window while Undo is available, not its later settled UI.
    if (preservesUndo) await expect(undo).toBeVisible()
  })
}
