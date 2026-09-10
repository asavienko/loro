import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, onboard, test } from './fixtures'
import { enter } from './helpers'
import { prepareScreenCapture, serializeScreenHtml } from './screenshots-serialize-html'
import { STATES } from './states'

const runDir = process.env.LORO_SCREENSHOT_RUN_DIR
if (runDir === undefined) throw new Error('LORO_SCREENSHOT_RUN_DIR was not configured.')

const FIXED_TIME = '2026-09-09T08:00:00.000Z'

interface CaptureManifest {
  run: {
    browser: {
      name: string | null
      version: string | null
    }
  }
}

test.beforeAll(({ browser }) => {
  const manifestPath = join(runDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CaptureManifest
  manifest.run.browser = {
    name: browser.browserType().name(),
    version: browser.version(),
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

    const image = join(runDir, 'images', filenameFor(state.name, 'png'))
    const html = join(runDir, 'html', 'screens', filenameFor(state.name, 'html'))
    mkdirSync(join(runDir, 'images'), { recursive: true })
    mkdirSync(join(runDir, 'html', 'screens'), { recursive: true })
    await page.screenshot({ path: image, animations: 'disabled', caret: 'hide' })
    writeFileSync(html, await page.evaluate(serializeScreenHtml))

    // This state exists to capture the window while Undo is available, not its later settled UI.
    if (preservesUndo) await expect(undo).toBeVisible()
  })
}

function filenameFor(name: string, extension: 'png' | 'html'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619)
  return `${slug || 'state'}-${(hash >>> 0).toString(16).padStart(8, '0')}.${extension}`
}
