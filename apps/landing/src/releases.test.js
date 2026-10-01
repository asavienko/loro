import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFromRelease,
  buildsFromCache,
  buildsFromReleases,
  changesFromCache,
  changesFromCompare,
  changesFromSingleCommit,
  changesRequest,
  commitTitle,
  formatDate,
  formatDay,
  formatSize,
} from './releases.js'
import { SNAPSHOT_COMMITS, SNAPSHOT_RELEASES } from './snapshot.js'

const BASE = 'https://github.com/asavienko/loro/releases'

/**
 * A release in GitHub's shape.
 *
 * @param {string} commit
 * @param {string} publishedAt
 * @param {{ draft?: boolean, apk?: boolean, digest?: string, body?: string }} [options]
 */
function release(commit, publishedAt, options = {}) {
  const short = commit.slice(0, 12)
  const tag = `apk-${short}-1`
  const name = `loro-preview-${short}.apk`
  /** @type {{ name: string, size: number, browser_download_url: string, digest?: string }[]} */
  const assets = [
    { name: 'build.json', size: 379, browser_download_url: `${BASE}/download/${tag}/build.json` },
  ]
  if (options.apk !== false) {
    assets.push(
      {
        name,
        size: 62_414_722,
        browser_download_url: `${BASE}/download/${tag}/${name}`,
        ...(options.digest === undefined ? {} : { digest: options.digest }),
      },
      {
        name: `${name}.sha256`,
        size: 96,
        browser_download_url: `${BASE}/download/${tag}/${name}.sha256`,
      },
    )
  }
  return {
    tag_name: tag,
    target_commitish: commit,
    published_at: publishedAt,
    created_at: publishedAt,
    html_url: `${BASE}/tag/${tag}`,
    draft: options.draft ?? false,
    body: options.body ?? '',
    assets,
  }
}

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)

await test('builds are newest first by publish date, whatever order GitHub lists them in', () => {
  const builds = buildsFromReleases([
    release(B, '2026-10-01T14:20:32Z'),
    release(A, '2026-10-01T22:22:18Z'),
    release(C, '2026-09-07T13:26:42Z'),
  ])
  assert.deepEqual(
    builds.map((build) => build.commit),
    [A, B, C],
  )
})

await test('drafts and releases without an APK are not offered', () => {
  const builds = buildsFromReleases([
    release(A, '2026-10-01T22:22:18Z', { draft: true }),
    release(B, '2026-10-01T20:00:00Z', { apk: false }),
    release(C, '2026-10-01T10:00:00Z'),
    'not a release',
  ])
  assert.deepEqual(
    builds.map((build) => build.commit),
    [C],
  )
})

await test('a build carries its links, size, short commit and the APK digest', () => {
  const build = buildFromRelease(
    release(A, '2026-10-01T22:22:18Z', { digest: `sha256:${'f'.repeat(64)}` }),
  )
  assert.ok(build)
  assert.equal(build.short, 'aaaaaaa')
  assert.equal(build.bytes, 62_414_722)
  assert.equal(build.apk, `${BASE}/download/apk-aaaaaaaaaaaa-1/loro-preview-aaaaaaaaaaaa.apk`)
  assert.equal(build.checksum, `${build.apk}.sha256`)
  assert.equal(build.page, `${BASE}/tag/apk-aaaaaaaaaaaa-1`)
  assert.equal(build.digest, 'f'.repeat(64))
})

await test('the digest falls back to the release notes, and the commit to the tag', () => {
  const raw = release(A, '2026-10-01T22:22:18Z', { body: `SHA-256: ${'E'.repeat(64)}\n` })
  const build = buildFromRelease({ ...raw, target_commitish: 'main' })
  assert.ok(build)
  assert.equal(build.digest, 'e'.repeat(64))
  assert.equal(build.commit, 'aaaaaaaaaaaa')
})

await test('links that are not GitHub are not followed', () => {
  const raw = release(A, '2026-10-01T22:22:18Z')
  const [apk] = raw.assets.filter((asset) => asset.name.endsWith('.apk'))
  assert.ok(apk)
  apk.browser_download_url = 'javascript:alert(1)'
  assert.equal(buildFromRelease(raw), null)
})

await test('the cache reads back what the page wrote, and drops what it did not', () => {
  const builds = buildsFromReleases([release(A, '2026-10-01T22:22:18Z')])
  assert.deepEqual(buildsFromCache(JSON.parse(JSON.stringify(builds))), builds)
  assert.deepEqual(buildsFromCache([{ apk: 'https://example.com/x.apk' }, null]), [])
  assert.deepEqual(buildsFromCache('nope'), [])
})

await test('dates read in UTC, sizes in megabytes', () => {
  assert.equal(formatDay('2026-09-07T13:26:42Z'), '7 Sep 2026')
  assert.equal(formatDate('2026-10-01T22:22:18Z'), '1 Oct 2026, 22:22 UTC')
  assert.equal(formatDate(''), '')
  assert.equal(formatSize(62_414_722), '62.4 MB')
  assert.equal(formatSize(51_950_960), '52.0 MB')
})

await test('a commit reads as a sentence without its type, scope, IDs or pull request', () => {
  assert.equal(
    commitTitle(
      'feat(mobile): a short echo after the target to say the phrase again (P3-01) (#61)',
    ),
    'A short echo after the target to say the phrase again',
  )
  assert.equal(
    commitTitle('LIB-03: Let learners ask for another mnemonic or grammar note (#60)\n\nBody'),
    'Let learners ask for another mnemonic or grammar note',
  )
  assert.equal(
    commitTitle('docs(docs): plan 111 records what was measured (AI-05, LIB-04)'),
    'Plan 111 records what was measured',
  )
  assert.equal(commitTitle('Note: keep this prefix'), 'Note: keep this prefix')
})

await test('changes between builds are newest first, without merges', () => {
  const result = changesFromCompare({
    total_commits: 5,
    commits: [
      {
        html_url: 'https://github.com/asavienko/loro/commit/1',
        commit: { message: 'fix(api): first (F-04)' },
        parents: [{}],
      },
      {
        html_url: 'https://github.com/asavienko/loro/commit/2',
        commit: { message: 'Merge branch main' },
        parents: [{}, {}],
      },
      {
        html_url: 'https://github.com/asavienko/loro/commit/3',
        commit: { message: 'feat(mobile): second' },
        parents: [{}],
      },
    ],
  })
  assert.deepEqual(result, {
    changes: [
      { title: 'Second', url: 'https://github.com/asavienko/loro/commit/3' },
      { title: 'First', url: 'https://github.com/asavienko/loro/commit/1' },
    ],
    truncated: 2,
  })
  assert.deepEqual(changesFromCompare(null), { changes: [], truncated: 0 })
  assert.deepEqual(changesFromCache(JSON.parse(JSON.stringify(result))), result)
  assert.equal(changesFromCache({ changes: 'x' }), null)
})

await test('the oldest build shows the commit it was made from', () => {
  assert.deepEqual(
    changesFromSingleCommit({
      html_url: 'https://github.com/asavienko/loro/commit/9',
      commit: { message: 'chore(ci): start' },
    }),
    {
      changes: [{ title: 'Start', url: 'https://github.com/asavienko/loro/commit/9' }],
      truncated: 0,
    },
  )
})

await test('a build is compared with the one published before it', () => {
  const builds = buildsFromReleases([
    release(B, '2026-10-01T10:00:00Z'),
    release(A, '2026-10-01T22:00:00Z'),
  ])
  assert.deepEqual(changesRequest(builds, 0), {
    key: 'bbbbbbbbbbbb...aaaaaaaaaaaa',
    api: 'https://api.github.com/repos/asavienko/loro/compare/bbbbbbbbbbbb...aaaaaaaaaaaa',
    page: 'https://github.com/asavienko/loro/compare/bbbbbbbbbbbb...aaaaaaaaaaaa',
    since: 'bbbbbbb',
  })
  assert.equal(
    changesRequest(builds, 1)?.api,
    `https://api.github.com/repos/asavienko/loro/commits/${B}`,
  )
  assert.equal(changesRequest(builds, 2), null)
})

await test('the saved list parses, newest first, and names the commits it knows', () => {
  const builds = buildsFromReleases(SNAPSHOT_RELEASES)
  assert.equal(builds.length, SNAPSHOT_RELEASES.length)
  assert.equal(builds[0]?.short, 'e30a848')
  assert.equal(builds.at(-1)?.short, '6891fe5')
  for (const build of builds) {
    assert.match(build.digest, /^[0-9a-f]{64}$/)
    assert.ok(build.apk.endsWith(`loro-preview-${build.commit.slice(0, 12)}.apk`))
  }
  assert.equal(
    commitTitle(SNAPSHOT_COMMITS['e30a8487d4b2'] ?? ''),
    'Let learners reuse earlier covers without drawing again',
  )
})
