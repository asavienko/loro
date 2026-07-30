/**
 * The same app, from the bundle that would ship.
 *
 * ── Why a second config rather than a second project ──
 * Playwright starts every declared `webServer` regardless of which project is selected, and
 * the export takes ten seconds to build. Folding it into the fast config would put that cost
 * on every local run of a single spec. So: separate configs, both built from
 * `config.shared.mjs`, differing only in which server is serving.
 *
 * ── Why it exists ──
 * The fast suite runs against `expo start --web`: a dev bundle, unminified, with React's
 * development build and its dev-only invariants. Nothing in the suite has ever loaded what
 * ships. The failures this catches are the ones the dev server hides — a module that Metro
 * resolves and the export does not, an asset missing from the export, code that only works
 * because a dev-only warning path swallowed it, or a minifier changing behaviour.
 *
 * ── Why only the tagged subset ──
 * This is a bundle check, not a second behaviour gate. Running everything twice would double
 * the wall clock to re-answer a question the fast suite already answered. `@smoke` marks the
 * first-run path, every route, and the full hero loop — enough that a broken bundle cannot
 * pass, and `testing-strategy.md:218` stays honoured.
 */

import { defineConfig } from '@playwright/test'
import { isCI, sharedTiming, sharedUse } from './config.shared.mjs'

const port = 8083
const exportDir = '.expo-export-web'

export default defineConfig({
  testDir: '.',
  outputDir: '../../../test-results/mobile-e2e-production',
  ...sharedTiming,
  grep: /@smoke/,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../../playwright-report/mobile-production', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...sharedUse,
  },
  webServer: {
    // Built here rather than in a CI step so `pnpm test:e2e:bundle` behaves the same on a
    // laptop as it does in CI, and so a stale export can never be the thing under test.
    command: `pnpm exec expo export --platform web --output-dir ${exportDir} --clear && pnpm exec tsx e2e/serveExport.ts ${exportDir} ${port}`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/onboarding`,
    timeout: 240_000,
    reuseExistingServer: !isCI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { EXPO_NO_TELEMETRY: '1' },
  },
})
