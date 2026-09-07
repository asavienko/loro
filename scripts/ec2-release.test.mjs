import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const scenario of ['success', 'candidate-failure', 'cutover-failure']) {
  test(`EC2 release: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loro-release-'))
    try {
      const script = readFileSync(new URL('./ec2-release.sh', import.meta.url), 'utf8').replace(
        '/var/lock/loro-api-deploy.lock',
        `${dir}/lock`,
      )
      writeFileSync(join(dir, 'release.sh'), script)
      writeFileSync(join(dir, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      writeFileSync(join(dir, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      writeFileSync(
        join(dir, 'docker'),
        `#!/bin/bash
printf '%s\\n' "$*" >> "$TEST_DIR/calls"
if [[ $1 == exec ]]; then
  if [[ $SCENARIO == candidate-failure && $2 == loro-api-candidate ]]; then exit 1; fi
  if [[ $SCENARIO == cutover-failure && $2 == loro-api && ! -f $TEST_DIR/restored ]]; then exit 1; fi
fi
if [[ $1 == start && $2 == loro-api ]]; then touch "$TEST_DIR/restored"; fi
exit 0
`,
        { mode: 0o755 },
      )
      const result = spawnSync('bash', [join(dir, 'release.sh'), 'loro-api:test'], {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          TEST_DIR: dir,
          SCENARIO: scenario,
        },
        encoding: 'utf8',
      })
      const calls = readFileSync(join(dir, 'calls'), 'utf8')
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr)
      if (scenario === 'candidate-failure') {
        assert.ok(!calls.includes('stop loro-api'))
      } else {
        assert.ok(calls.includes('rename loro-api loro-api-previous'))
        assert.ok(calls.includes('-p 127.0.0.1:3000:3000'))
        assert.equal(calls.includes('start loro-api'), scenario === 'cutover-failure')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
