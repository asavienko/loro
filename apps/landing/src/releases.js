// What the download section offers: the repository's GitHub releases that carry an Android APK,
// newest first, and what changed from one build to the next. Pure functions over GitHub's JSON, so
// node:test covers them; main.js does the fetching and the DOM.

export const REPO = 'asavienko/loro'
export const API = `https://api.github.com/repos/${REPO}`
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const COMMIT_TYPES = 'feat|fix|perf|refactor|test|docs|chore|content|revert|build|ci|style'

/**
 * @typedef {object} Build
 * @property {string} tag
 * @property {string} commit The commit the APK was built from (full, or the tag's 12 characters).
 * @property {string} short
 * @property {string} publishedAt ISO 8601, UTC.
 * @property {number} bytes
 * @property {string} apk
 * @property {string} checksum The `.sha256` file's link, or ''.
 * @property {string} page
 * @property {string} digest The APK's SHA-256 in hex, or ''.
 */

/**
 * @typedef {object} Change
 * @property {string} title
 * @property {string} url
 */

/**
 * @typedef {object} Changes
 * @property {Change[]} changes Newest first.
 * @property {number} truncated Commits GitHub counted but did not list.
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 */
function text(record, key) {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 */
function count(record, key) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * A link the page may follow: GitHub's own pages and downloads, nothing else.
 *
 * @param {string} url
 */
export function githubUrl(url) {
  return url.startsWith('https://github.com/') ? url : ''
}

/**
 * @param {string} target
 * @param {string} tag
 */
function commitOf(target, tag) {
  if (/^[0-9a-f]{40}$/.test(target)) return target
  return /^apk-([0-9a-f]{7,40})-/.exec(tag)?.[1] ?? ''
}

/**
 * @param {string} assetDigest
 * @param {string} body
 */
function digestOf(assetDigest, body) {
  const fromAsset = /^sha256:([0-9a-f]{64})$/.exec(assetDigest)?.[1]
  if (fromAsset) return fromAsset
  return /SHA-256:\s*([0-9a-f]{64})/i.exec(body)?.[1]?.toLowerCase() ?? ''
}

/**
 * One release as a build, or null for a draft or a release without an APK.
 *
 * @param {unknown} release
 * @returns {Build | null}
 */
export function buildFromRelease(release) {
  if (!isRecord(release) || release['draft'] === true) return null
  /** @type {unknown[]} */
  const listed = Array.isArray(release['assets']) ? release['assets'] : []
  const assets = listed.filter(isRecord)
  const apk = assets.find((asset) => text(asset, 'name').endsWith('.apk'))
  if (!apk) return null
  const apkUrl = githubUrl(text(apk, 'browser_download_url'))
  if (!apkUrl) return null
  const checksum = assets.find((asset) => text(asset, 'name') === `${text(apk, 'name')}.sha256`)
  const tag = text(release, 'tag_name')
  const commit = commitOf(text(release, 'target_commitish'), tag)
  return {
    tag,
    commit,
    short: commit.slice(0, 7),
    publishedAt: text(release, 'published_at') || text(release, 'created_at'),
    bytes: count(apk, 'size'),
    apk: apkUrl,
    checksum: checksum ? githubUrl(text(checksum, 'browser_download_url')) : '',
    page: githubUrl(text(release, 'html_url')),
    digest: digestOf(text(apk, 'digest'), text(release, 'body')),
  }
}

/** @param {string} iso */
function time(iso) {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Newest first by publish date. GitHub lists releases by when they were created, which is not the
 * order they were published in.
 *
 * @param {readonly Build[]} builds
 */
export function newestFirst(builds) {
  return [...builds].sort(
    (a, b) => time(b.publishedAt) - time(a.publishedAt) || b.tag.localeCompare(a.tag),
  )
}

/**
 * GitHub's release list (any number of pages, concatenated) as builds, newest first.
 *
 * @param {unknown} releases
 * @returns {Build[]}
 */
export function buildsFromReleases(releases) {
  /** @type {unknown[]} */
  const list = Array.isArray(releases) ? releases : []
  /** @type {Build[]} */
  const builds = []
  for (const release of list) {
    const build = buildFromRelease(release)
    if (build) builds.push(build)
  }
  return newestFirst(builds)
}

/**
 * Builds read back from the page's own cache; anything malformed is dropped.
 *
 * @param {unknown} value
 * @returns {Build[]}
 */
export function buildsFromCache(value) {
  /** @type {unknown[]} */
  const list = Array.isArray(value) ? value : []
  /** @type {Build[]} */
  const builds = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const apk = githubUrl(text(item, 'apk'))
    if (!apk) continue
    builds.push({
      tag: text(item, 'tag'),
      commit: text(item, 'commit'),
      short: text(item, 'short'),
      publishedAt: text(item, 'publishedAt'),
      bytes: count(item, 'bytes'),
      apk,
      checksum: githubUrl(text(item, 'checksum')),
      page: githubUrl(text(item, 'page')),
      digest: text(item, 'digest'),
    })
  }
  return newestFirst(builds)
}

/** @param {string} iso */
export function formatDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  const [, year = '', month = '', day = ''] = match
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''} ${year}`
}

/** @param {string} iso */
export function formatDate(iso) {
  const day = formatDay(iso)
  const match = /T(\d{2}):(\d{2})/.exec(iso)
  if (!match) return day
  const [, hours = '', minutes = ''] = match
  return `${day}, ${hours}:${minutes} UTC`
}

/** @param {number} bytes */
export function formatSize(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/**
 * A commit's first line as a sentence: without its Conventional Commits type and scope, a leading
 * requirement ID, or the trailing requirement IDs and pull request number.
 *
 * @param {string} message
 */
export function commitTitle(message) {
  let title = (message.split('\n')[0] ?? '').trim()
  title = title
    .replace(new RegExp(`^(${COMMIT_TYPES})(\\([^)]*\\))?!?:\\s*`, 'i'), '')
    .replace(/^[A-Z][A-Z0-9]*-\d+:\s*/, '')
  for (let i = 0; i < 4; i += 1) {
    const shorter = title.replace(/\s*\((#\d+|[A-Z][A-Z0-9]*-\d+(,\s*[A-Z][A-Z0-9]*-\d+)*)\)$/, '')
    if (shorter === title) break
    title = shorter
  }
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/**
 * @param {unknown} entry One commit from GitHub's commit or compare API.
 * @returns {Change | null}
 */
function changeFromCommit(entry) {
  if (!isRecord(entry)) return null
  const parents = entry['parents']
  if (Array.isArray(parents) && parents.length > 1) return null
  const commit = entry['commit']
  const title = commitTitle(isRecord(commit) ? text(commit, 'message') : '')
  return title ? { title, url: githubUrl(text(entry, 'html_url')) } : null
}

/**
 * What changed between two builds: GitHub's compare of base...head, merges left out, newest first.
 *
 * @param {unknown} compare
 * @returns {Changes}
 */
export function changesFromCompare(compare) {
  if (!isRecord(compare)) return { changes: [], truncated: 0 }
  /** @type {unknown[]} */
  const commits = Array.isArray(compare['commits']) ? compare['commits'] : []
  /** @type {Change[]} */
  const changes = []
  for (const entry of commits) {
    const change = changeFromCommit(entry)
    if (change) changes.unshift(change)
  }
  return { changes, truncated: Math.max(0, count(compare, 'total_commits') - commits.length) }
}

/**
 * The oldest build has no build before it: only the commit it was made from.
 *
 * @param {unknown} commit
 * @returns {Changes}
 */
export function changesFromSingleCommit(commit) {
  const change = changeFromCommit(commit)
  return { changes: change ? [change] : [], truncated: 0 }
}

/**
 * Changes read back from the page's own cache, or null if they are not there or malformed.
 *
 * @param {unknown} value
 * @returns {Changes | null}
 */
export function changesFromCache(value) {
  if (!isRecord(value) || !Array.isArray(value['changes'])) return null
  /** @type {unknown[]} */
  const list = value['changes']
  /** @type {Change[]} */
  const changes = []
  for (const item of list) {
    if (isRecord(item) && text(item, 'title')) {
      changes.push({ title: text(item, 'title'), url: githubUrl(text(item, 'url')) })
    }
  }
  return { changes, truncated: count(value, 'truncated') }
}

/**
 * Where to read what the build at `index` changed: a compare with the build published before it,
 * or the oldest build's own commit.
 *
 * @param {readonly Build[]} builds Newest first.
 * @param {number} index
 */
export function changesRequest(builds, index) {
  const build = builds[index]
  if (!build?.commit) return null
  const previous = builds[index + 1]
  if (previous?.commit) {
    const range = `${previous.commit.slice(0, 12)}...${build.commit.slice(0, 12)}`
    return {
      key: range,
      api: `${API}/compare/${range}`,
      page: `https://github.com/${REPO}/compare/${range}`,
      since: previous.short,
    }
  }
  return {
    key: build.commit,
    api: `${API}/commits/${build.commit}`,
    page: `https://github.com/${REPO}/commit/${build.commit}`,
    since: '',
  }
}
