import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const scenario of [
  'success',
  'candidate-failure',
  'cutover-failure',
  'configured-success',
  'backup-failure',
  'seed-failure',
]) {
  test(`EC2 release: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loro-release-'))
    try {
      const configured = scenario === 'configured-success' || scenario === 'backup-failure'
      const script = readFileSync(new URL('./ec2-release.sh', import.meta.url), 'utf8')
        .replace('/var/lock/loro-api-deploy.lock', `${dir}/lock`)
        .replaceAll('/opt/loro/', `${dir}/`)
      writeFileSync(join(dir, 'release.sh'), script)
      writeFileSync(join(dir, 'api.env'), 'DATABASE_URL=not-printed\n', { mode: 0o600 })
      writeFileSync(join(dir, 'stat'), '#!/bin/sh\necho 0:600\n', { mode: 0o755 })
      writeFileSync(join(dir, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      writeFileSync(join(dir, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      writeFileSync(
        join(dir, 'docker'),
        `#!/bin/bash
printf '%s\\n' "$*" >> "$TEST_DIR/calls"
if [[ $1 == exec && $3 == pg_dump ]]; then
  [[ $SCENARIO != backup-failure ]] || exit 1
  echo backup-data
fi
if [[ $1 == exec ]]; then
  if [[ $SCENARIO == candidate-failure && $2 == loro-api-candidate ]]; then exit 1; fi
  if [[ $SCENARIO == cutover-failure && $2 == loro-api && ! -f $TEST_DIR/restored ]]; then exit 1; fi
  # Readiness passes but the library's seed fails: only the pack probe answers badly.
  if [[ $SCENARIO == seed-failure && $* == *library/pack* ]]; then exit 1; fi
fi
if [[ $1 == start && $2 == loro-api ]]; then touch "$TEST_DIR/restored"; fi
exit 0
`,
        { mode: 0o755 },
      )
      const result = spawnSync(
        'bash',
        [
          join(dir, 'release.sh'),
          'loro-api:test',
          ...(configured ? [join(dir, 'api.env'), 'loro-backend'] : []),
        ],
        {
          env: {
            ...process.env,
            PATH: `${dir}:${process.env.PATH}`,
            TEST_DIR: dir,
            SCENARIO: scenario,
          },
          encoding: 'utf8',
        },
      )
      const calls = readFileSync(join(dir, 'calls'), 'utf8')
      assert.equal(
        result.status,
        ['success', 'configured-success'].includes(scenario) ? 0 : 1,
        result.stderr,
      )
      if (configured) {
        assert.ok(calls.includes('pg_dump -U postgres -d loro -Fc'))
        if (scenario === 'configured-success')
          assert.ok(calls.includes(`--env-file ${dir}/api.env --network loro-backend`))
        else assert.ok(!calls.includes('run -d'))
      }
      const probes = calls.split('\n').filter((call) => call.includes('/v1/health/ready'))
      const seeded = (call) => call.includes('/v1/library/pack?target=es-ES')
      if (scenario !== 'backup-failure') {
        // The candidate proves the library seeds before anything is stopped.
        assert.ok(probes[0]?.startsWith('exec loro-api-candidate') && seeded(probes[0]))
      }
      if (scenario === 'cutover-failure') {
        // The new active container is held to the library; the restored previous one to readiness.
        assert.ok(seeded(probes.find((call) => call.startsWith('exec loro-api ')) ?? ''))
        assert.ok(!seeded(probes.at(-1) ?? ''))
      }
      if (['candidate-failure', 'backup-failure', 'seed-failure'].includes(scenario)) {
        assert.ok(!calls.includes('stop loro-api'))
      } else {
        assert.ok(calls.includes('rename loro-api loro-api-previous'))
        assert.ok(calls.includes('-p 127.0.0.1:3000:3000'))
        // Behind the gateway's nginx, auth limits key on X-Real-IP; every container is told so.
        const runs = calls.split('\n').filter((call) => call.startsWith('run -d'))
        assert.ok(runs.length >= 2 && runs.every((call) => call.includes('-e TRUST_PROXY=1')))
        assert.equal(calls.includes('start loro-api'), scenario === 'cutover-failure')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
