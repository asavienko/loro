#!/usr/bin/env node
/**
 * Full local CI orchestration.
 *
 * The shell wrapper owns environment/mode checks. This module owns the dependency graph,
 * bounded concurrency, isolated browser workspaces, and cleanup. Keeping this in Node makes the
 * scheduler testable without starting Docker, Expo, or a Rust build.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_JOB_LIMIT, ROOT, parsePositiveInteger } from './ci-local/root.mjs'
import {
  assertGeneratedIdentity,
  assertSourceIdentity,
  captureSourceIdentity,
  checkGeneratedDrift,
  copySourceWorkspace,
  createSourceInventory,
  fingerprintPaths,
  samePaths,
} from './ci-local/inventory.mjs'
import {
  activeWorkspaces,
  cleanupDockerResources,
  ensureNotInterrupted,
  isInterrupted,
  runCommand,
  runJobs,
  terminateOwnedProcesses,
  waitForTermination,
} from './ci-local/jobs.mjs'
import {
  acquireLock,
  baseEnvironment,
  commandJob,
  isolatedJob,
  logEvent,
} from './ci-local/workspace.mjs'

export { ROOT, DEFAULT_JOB_LIMIT, parsePositiveInteger } from './ci-local/root.mjs'
export {
  createSourceInventory,
  sourceFingerprint,
  captureSourceIdentity,
  assertSourceIdentity,
  copySourceWorkspace,
  checkGeneratedDrift,
} from './ci-local/inventory.mjs'
export {
  reservePort,
  runJobs,
  terminateOwnedProcesses,
  runCommand,
  cleanupDockerResources,
} from './ci-local/jobs.mjs'
export { runInIsolatedWorkspace } from './ci-local/workspace.mjs'

async function main() {
  const turboConcurrency = parsePositiveInteger(
    process.env.LORO_CI_CONCURRENCY,
    'LORO_CI_CONCURRENCY',
    2,
  )
  const jobLimit = parsePositiveInteger(process.env.LORO_CI_JOBS, 'LORO_CI_JOBS', DEFAULT_JOB_LIMIT)
  const runId = `${new Date().toISOString().replaceAll(/[^0-9]/g, '')}-${process.pid}`
  const reportDirectory = join(ROOT, '.ci-local-reports', runId)
  mkdirSync(reportDirectory, { recursive: true })
  const releaseLock = acquireLock(ROOT, runId)
  const environment = baseEnvironment()
  const logDirectory = join(reportDirectory, 'logs')
  mkdirSync(logDirectory, { recursive: true })
  const summaryPath = join(reportDirectory, 'summary.json')
  writeFileSync(
    summaryPath,
    `${JSON.stringify({ runId, jobLimit, turboConcurrency, status: 'running' }, null, 2)}\n`,
    'utf8',
  )
  let startingIdentity
  let snapshot

  try {
    startingIdentity = captureSourceIdentity(ROOT)
    writeFileSync(
      join(reportDirectory, 'source-identity.json'),
      `${JSON.stringify(
        {
          commit: startingIdentity.commit,
          authoredFingerprint: startingIdentity.authoredFingerprint,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    const install = await runCommand('install', 'pnpm', ['install', '--frozen-lockfile'], {
      cwd: ROOT,
      env: environment,
      logDirectory,
    })
    if (install.code !== 0) throw new Error('Dependency installation failed')
    ensureNotInterrupted('dependency installation')
    assertSourceIdentity(ROOT, startingIdentity, 'dependency installation')

    const preparation = await runJobs(
      [
        commandJob('core-rs-build', 'pnpm', ['core-rs:build'], {
          cwd: ROOT,
          env: environment,
          logDirectory,
        }),
      ],
      {
        limit: jobLimit,
        onEvent: (event) => logEvent(reportDirectory, event),
        shouldStop: () => isInterrupted(),
      },
    )
    if (!preparation.ok) throw new Error('Preparation failed')
    if (!existsSync(join(ROOT, 'packages/core-rs/pkg/loro_core_bg.wasm')))
      throw new Error('WASM output is missing')
    ensureNotInterrupted('preparation')
    assertSourceIdentity(ROOT, startingIdentity, 'preparation')

    const check = await runCommand(
      'check',
      'pnpm',
      ['check', `--concurrency=${turboConcurrency}`],
      {
        cwd: ROOT,
        env: environment,
        logDirectory,
      },
    )
    if (check.code !== 0) throw new Error('Fast check failed')
    ensureNotInterrupted('fast check')
    assertSourceIdentity(ROOT, startingIdentity, 'fast check')

    const followupJobs = [
      commandJob('auth-postgres', 'bash', ['scripts/ci-auth-postgres.sh'], {
        cwd: ROOT,
        env: { ...environment, AUTH_TEST_DATABASE_URL: '', LORO_TEST_DATABASE_URL: '' },
        logDirectory,
      }),
      commandJob('format', 'pnpm', ['format:check'], { cwd: ROOT, env: environment, logDirectory }),
      commandJob('golden', 'cargo', ['test', '--test', 'golden', '--', '--nocapture'], {
        cwd: join(ROOT, 'packages/core-rs'),
        env: environment,
        logDirectory,
      }),
    ]
    if (process.env.CI_BASE_REF) {
      followupJobs.push(
        commandJob(
          'commitlint',
          'pnpm',
          ['exec', 'commitlint', '--from', process.env.CI_BASE_REF, '--to', 'HEAD'],
          { cwd: ROOT, env: environment, logDirectory },
        ),
      )
    } else {
      console.log('Commit range not provided; commit lint is omitted.')
    }
    const goldenIndex = followupJobs.findIndex((job) => job.name === 'golden')
    if (
      !existsSync(join(ROOT, 'packages/core-rs/tests/golden.rs')) &&
      !existsSync(join(ROOT, 'packages/core-rs/tests/golden/main.rs'))
    ) {
      followupJobs.splice(goldenIndex, 1)
      console.log('Golden test target is absent; it is omitted.')
    }
    followupJobs.push({
      name: 'generated-drift',
      run: () => {
        const drift = checkGeneratedDrift(ROOT)
        if (drift.code) console.error(`Generated output differs from Git:\n${drift.status}`)
        return { code: drift.code }
      },
    })
    const followup = await runJobs(followupJobs, {
      limit: jobLimit,
      onEvent: (event) => logEvent(reportDirectory, event),
      shouldStop: () => isInterrupted(),
    })
    if (!followup.ok) throw new Error('Post-check validation failed')
    ensureNotInterrupted('post-check validation')
    assertSourceIdentity(ROOT, startingIdentity, 'post-check validation')

    snapshot = mkdtempSync(join(tmpdir(), 'loro-ci-snapshot-'))
    ensureNotInterrupted('snapshot creation')
    const snapshotInventory = createSourceInventory(ROOT)
    if (!samePaths(snapshotInventory.authoredPaths, startingIdentity.authoredPaths))
      throw new Error('Authored source inventory changed before snapshot creation')
    const sourceAuthoredFingerprint = fingerprintPaths(ROOT, snapshotInventory.authoredPaths)
    if (sourceAuthoredFingerprint !== startingIdentity.authoredFingerprint)
      throw new Error('Authored source changed before snapshot creation')
    const sourceGeneratedFingerprint = fingerprintPaths(ROOT, snapshotInventory.generatedPaths)
    copySourceWorkspace(ROOT, snapshot, snapshotInventory)
    ensureNotInterrupted('snapshot copy')
    assertSourceIdentity(ROOT, startingIdentity, 'snapshot copy')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      sourceGeneratedFingerprint,
      'snapshot copy',
    )
    const snapshotAuthoredFingerprint = fingerprintPaths(snapshot, snapshotInventory.authoredPaths)
    if (snapshotAuthoredFingerprint !== sourceAuthoredFingerprint)
      throw new Error('Snapshot authored source differs from the starting source')
    const snapshotGeneratedFingerprint = fingerprintPaths(
      snapshot,
      snapshotInventory.generatedPaths,
    )
    if (snapshotGeneratedFingerprint !== sourceGeneratedFingerprint)
      throw new Error('Snapshot generated inputs differ from the source')
    writeFileSync(
      join(reportDirectory, 'source-identity.json'),
      `${JSON.stringify(
        {
          commit: startingIdentity.commit,
          authoredFingerprint: snapshotAuthoredFingerprint,
          generatedFingerprint: snapshotGeneratedFingerprint,
          generatedPaths: snapshotInventory.generatedPaths,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const browserEnvironment = { ...environment }
    const browserJobs = []
    const imageCheckPrefix = `loro-image-check-${runId}`
    const apiSmokeContainer = `loro-built-api-check-${runId}`
    browserJobs.push(
      isolatedJob(
        'mobile-bundle',
        snapshot,
        [['bundle', 'pnpm', ['--filter', '@loro/mobile', 'bundle']]],
        {
          reportDirectory,
          logDirectory,
          inventory: snapshotInventory,
          extraEnv: browserEnvironment,
        },
      ),
      isolatedJob(
        'api-verification',
        snapshot,
        [
          ['api-build', 'pnpm', ['--filter', '@loro/api', 'build']],
          ['api-smoke', process.execPath, ['scripts/ci-api-smoke.mjs']],
          [
            'image-build',
            'docker',
            [
              'build',
              '--platform',
              'linux/amd64',
              '-f',
              'apps/api/Dockerfile',
              '-t',
              `loro-api:local-check-${runId}`,
              '.',
            ],
          ],
          ['image-check', 'bash', ['scripts/ci-api-image.sh', `loro-api:local-check-${runId}`]],
        ],
        {
          reportDirectory,
          logDirectory,
          inventory: snapshotInventory,
          extraEnv: {
            ...browserEnvironment,
            LORO_API_IMAGE_CHECK_PREFIX: imageCheckPrefix,
            LORO_API_SMOKE_CONTAINER: apiSmokeContainer,
          },
          cleanup: () => {
            cleanupDockerResources({
              containers: [
                imageCheckPrefix,
                `${imageCheckPrefix}-database`,
                `${imageCheckPrefix}-content`,
                apiSmokeContainer,
              ],
              networks: [`${imageCheckPrefix}-network`],
              image: `loro-api:local-check-${runId}`,
            })
          },
        },
      ),
    )
    const browserResult = await runJobs(browserJobs, {
      limit: jobLimit,
      onEvent: (event) => logEvent(reportDirectory, event),
      shouldStop: () => isInterrupted(),
    })
    if (!browserResult.ok) throw new Error('Isolated verification failed')
    ensureNotInterrupted('isolated verification')
    assertSourceIdentity(ROOT, startingIdentity, 'isolated verification')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      snapshotGeneratedFingerprint,
      'isolated verification',
    )

    const benchmark = await runCommand(
      'benchmarks',
      'cargo',
      ['bench', '--bench', 'core_benches', '--', '--warm-up-time', '1', '--measurement-time', '2'],
      {
        cwd: join(ROOT, 'packages/core-rs'),
        env: environment,
        logDirectory,
      },
    )
    if (benchmark.code !== 0) throw new Error('Benchmarks failed')
    ensureNotInterrupted('benchmarks')
    assertSourceIdentity(ROOT, startingIdentity, 'benchmarks')
    assertGeneratedIdentity(
      ROOT,
      snapshotInventory.generatedPaths,
      snapshotGeneratedFingerprint,
      'benchmarks',
    )
    ensureNotInterrupted('final validation')

    const summary = {
      runId,
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      jobLimit,
      turboConcurrency,
      sourceFingerprint: snapshotAuthoredFingerprint,
      generatedFingerprint: snapshotGeneratedFingerprint,
      status: 'passed',
    }
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(`Local CI passed. Reports: ${reportDirectory}`)
  } catch (error) {
    writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          runId,
          jobLimit,
          turboConcurrency,
          status: 'failed',
          interrupted: isInterrupted(),
          commit: startingIdentity?.commit,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    throw error
  } finally {
    if (waitForTermination()) await waitForTermination()
    for (const workspace of activeWorkspaces) rmSync(workspace, { recursive: true, force: true })
    if (snapshot) rmSync(snapshot, { recursive: true, force: true })
    releaseLock()
  }
}

const signalHandler = () => terminateOwnedProcesses()
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Local CI failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = isInterrupted() ? 130 : 1
  })
}
