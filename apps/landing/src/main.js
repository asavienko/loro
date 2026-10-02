// The landing page's behaviour: the builds (read from GitHub on each visit, newest first), what each
// one changed, the player demo, the language drum and the pointer tilt. Everything GitHub returns
// goes into the page as text or as a checked github.com link, never as HTML. What the visitor does
// with the page (a download, the film, a course) is recorded through ./analytics.js.

import { setUpAnalytics, track } from './analytics.js'
import {
  API,
  RELEASES_PAGE,
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
import { SNAPSHOT_COMMITS, SNAPSHOT_DATE, SNAPSHOT_RELEASES } from './snapshot.js'

/** @typedef {import('./releases.js').Build} Build */
/** @typedef {import('./releases.js').Changes} Changes */
/** @typedef {'loading' | 'live' | 'saved' | 'snapshot'} Source */

const RELEASES_KEY = 'loro.landing.releases.v1'
const CHANGES_KEY = 'loro.landing.changes.v1.'
const FRESH_MS = 10 * 60 * 1000
const LISTED = 8
const SHOWN_CHANGES = 5
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// ── DOM helpers ──

/**
 * @param {string} selector
 * @param {ParentNode} [root]
 */
function one(selector, root = document) {
  const element = root.querySelector(selector)
  if (!(element instanceof HTMLElement)) throw new Error(`The page has no ${selector}`)
  return element
}

/**
 * @param {string} selector
 * @param {ParentNode} [root]
 */
function every(selector, root = document) {
  return [...root.querySelectorAll(selector)].filter((element) => element instanceof HTMLElement)
}

/**
 * @param {string} selector
 * @param {string} value
 */
function fill(selector, value) {
  for (const element of every(selector)) element.textContent = value
}

/**
 * @param {HTMLElement} link
 * @param {string} href
 */
function point(link, href) {
  link.setAttribute('href', href || RELEASES_PAGE)
}

// ── Storage: a convenience only; the page works the same without it ──

/** @param {string} key */
function readStore(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : /** @type {unknown} */ (JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is off or full: the next visit asks GitHub again.
  }
}

// ── GitHub ──

/** @param {string} url */
async function github(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${url}`)
  /** @type {unknown} */
  const body = await response.json()
  return body
}

/** Every release, all pages of them, as builds newest first. */
async function fetchBuilds() {
  /** @type {unknown[]} */
  const releases = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(`${API}/releases?per_page=100&page=${page}`)
    if (!Array.isArray(batch)) break
    /** @type {unknown[]} */
    const list = batch
    releases.push(...list)
    if (list.length < 100) break
  }
  return buildsFromReleases(releases)
}

// ── Builds ──

/**
 * `picked` is true once the visitor chooses a build; until then the ticket follows the newest.
 *
 * @type {{ builds: Build[], source: Source, checkedAt: number, selected: string, picked: boolean, expanded: boolean }}
 */
const downloads = {
  builds: buildsFromReleases(SNAPSHOT_RELEASES),
  source: 'loading',
  checkedAt: 0,
  selected: '',
  picked: false,
  expanded: false,
}

/** @returns {{ at: number, builds: Build[] } | null} */
function readCachedBuilds() {
  const value = readStore(RELEASES_KEY)
  if (typeof value !== 'object' || value === null || !('at' in value) || !('builds' in value))
    return null
  const at = typeof value.at === 'number' ? value.at : 0
  const builds = buildsFromCache(value.builds)
  return builds.length > 0 ? { at, builds } : null
}

/**
 * @param {Build[]} builds
 * @param {Source} source
 * @param {number} checkedAt
 */
function show(builds, source, checkedAt) {
  if (source !== 'live') track('builds_unavailable', { source })
  downloads.builds = builds
  downloads.source = source
  downloads.checkedAt = checkedAt
  const kept = downloads.picked && builds.some((build) => build.tag === downloads.selected)
  if (!kept) downloads.selected = builds[0]?.tag ?? ''
  renderDownloads()
}

/** @param {boolean} [force] Ask GitHub even if the cached list is fresh. */
async function loadBuilds(force = false) {
  const cached = readCachedBuilds()
  if (!force && cached && Date.now() - cached.at < FRESH_MS) {
    show(cached.builds, 'live', cached.at)
    return
  }
  downloads.source = 'loading'
  renderStatus()
  try {
    const builds = await fetchBuilds()
    const now = Date.now()
    writeStore(RELEASES_KEY, { at: now, builds })
    show(builds, 'live', now)
  } catch {
    if (cached) show(cached.builds, 'saved', cached.at)
    else show(buildsFromReleases(SNAPSHOT_RELEASES), 'snapshot', 0)
  }
}

function selectedIndex() {
  const index = downloads.builds.findIndex((build) => build.tag === downloads.selected)
  return Math.max(0, index)
}

/** @param {number} at */
function clock(at) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function renderStatus() {
  const status = one('#builds-status')
  const text = one('#builds-status-text')
  const retry = one('#builds-retry')
  status.dataset['source'] = downloads.source
  retry.hidden = downloads.source === 'live' || downloads.source === 'loading'
  switch (downloads.source) {
    case 'loading':
      text.textContent = 'Checking GitHub for new builds…'
      break
    case 'live':
      text.textContent = `Live from GitHub · checked at ${clock(downloads.checkedAt)}`
      break
    case 'saved':
      text.textContent = `GitHub can’t be reached right now, so this is the list from ${clock(downloads.checkedAt)}.`
      break
    case 'snapshot':
      text.textContent = `GitHub can’t be reached right now, so this is the list saved on ${formatDay(SNAPSHOT_DATE)}.`
      break
  }
}

function renderDownloads() {
  const { builds } = downloads
  const latest = builds[0]
  fill('[data-latest="day"]', latest ? formatDay(latest.publishedAt) : '')
  fill('[data-latest="short"]', latest?.short ?? '')
  fill('[data-latest="size"]', latest ? formatSize(latest.bytes) : '')
  for (const link of every('a[data-latest-apk]')) point(link, latest?.apk ?? '')
  one('#builds-count').textContent =
    builds.length === 1 ? '1 build, newest first' : `${builds.length} builds, newest first`
  renderStatus()
  renderList()
  renderTicket()
  void renderChanges()
}

function renderList() {
  const list = one('#builds')
  const more = one('#builds-more')
  const template = document.getElementById('build-row')
  if (!(template instanceof HTMLTemplateElement)) return
  const index = selectedIndex()
  const visible = downloads.expanded ? downloads.builds.length : Math.max(LISTED, index + 1)
  const rows = downloads.builds.slice(0, visible).map((build, i) => {
    const row = template.content.firstElementChild?.cloneNode(true)
    if (!(row instanceof HTMLElement)) throw new Error('The build row template is empty')
    const on = build.tag === downloads.selected
    const date = formatDate(build.publishedAt)
    const size = formatSize(build.bytes)
    row.classList.toggle('on', on)
    row.style.animationDelay = `${Math.min(i, 10) * 40}ms`
    one('.vshort', row).textContent = build.short
    one('.vlat', row).hidden = i !== 0
    one('.vsub', row).textContent = `${date} · ${size}`
    const pick = one('.vpick', row)
    pick.setAttribute('aria-pressed', String(on))
    pick.setAttribute('aria-label', `Show build ${build.short} from ${date}`)
    pick.addEventListener('click', () => {
      downloads.selected = build.tag
      downloads.picked = true
      track('build_picked', { build: build.short, latest: i === 0 })
      renderList()
      renderTicket()
      void renderChanges()
    })
    const link = one('.vdl', row)
    point(link, build.apk)
    link.setAttribute('aria-label', `Download build ${build.short}, ${size}`)
    link.addEventListener('click', () => {
      track('download_clicked', { build: build.short, where: 'list' })
    })
    return row
  })
  list.replaceChildren(...rows)
  const hidden = downloads.builds.length - visible
  more.hidden = hidden <= 0
  more.textContent = hidden === 1 ? 'Show 1 earlier build' : `Show ${hidden} earlier builds`
}

function renderTicket() {
  const build = downloads.builds[selectedIndex()]
  const ticket = one('.ticket')
  ticket.hidden = !build
  if (!build) return
  const latest = build.tag === downloads.builds[0]?.tag
  one('#tk-latest').hidden = !latest
  one('#tk-older').hidden = latest
  fill('[data-cur="date"]', formatDate(build.publishedAt))
  fill('[data-cur="short"]', build.short)
  fill('[data-cur="size"]', formatSize(build.bytes))
  const digest = one('#tk-digest')
  digest.textContent = build.digest
    ? `${build.digest.slice(0, 10)}…${build.digest.slice(-10)}`
    : 'not published'
  digest.title = build.digest
  one('#tk-copy').hidden = !build.digest
  one('#tk-copy-label').textContent = 'Copy'
  point(one('#tk-apk'), build.apk)
  const sum = one('#tk-sum')
  sum.hidden = !build.checksum
  point(sum, build.checksum)
  point(one('#tk-page'), build.page)
}

let changesToken = 0

/**
 * @param {Changes} result
 * @param {string} page
 */
function fillChanges(result, page) {
  const list = one('#changes-list')
  const state = one('#changes-state')
  const more = one('#changes-more')
  const items = result.changes.slice(0, SHOWN_CHANGES).map((change, i) => {
    const item = document.createElement('li')
    item.style.animationDelay = `${i * 60}ms`
    if (change.url) {
      const link = document.createElement('a')
      link.href = change.url
      link.rel = 'noopener'
      link.textContent = change.title
      item.append(link)
    } else {
      item.textContent = change.title
    }
    return item
  })
  list.replaceChildren(...items)
  state.hidden = items.length > 0
  state.textContent = 'The same code as the build before it.'
  const hidden = result.changes.length - items.length + result.truncated
  more.hidden = hidden <= 0
  more.textContent = hidden === 1 ? 'And 1 more on GitHub' : `And ${hidden} more on GitHub`
  point(more, page)
}

async function renderChanges() {
  changesToken += 1
  const token = changesToken
  const box = one('#changes')
  const title = one('#changes-title')
  const list = one('#changes-list')
  const state = one('#changes-state')
  const more = one('#changes-more')
  const index = selectedIndex()
  const build = downloads.builds[index]
  const request = changesRequest(downloads.builds, index)
  // While the list itself is loading it may still change, so nothing is asked of GitHub yet.
  box.hidden = !build || !request || downloads.source === 'loading'
  if (!build || !request || downloads.source === 'loading') return

  if (downloads.source === 'snapshot') {
    const message = SNAPSHOT_COMMITS[build.commit.slice(0, 12)]
    title.textContent = 'Built from'
    if (message) {
      fillChanges(
        { changes: [{ title: commitTitle(message), url: '' }], truncated: 0 },
        request.page,
      )
    } else {
      box.hidden = true
    }
    return
  }

  title.textContent = request.since ? `What changed since ${request.since}` : 'Built from'
  const key = `${CHANGES_KEY}${request.key}`
  const cached = changesFromCache(readStore(key))
  if (cached) {
    fillChanges(cached, request.page)
    return
  }
  list.replaceChildren()
  more.hidden = true
  state.hidden = false
  state.textContent = 'Reading the commits…'
  try {
    const data = await github(request.api)
    const result = request.since ? changesFromCompare(data) : changesFromSingleCommit(data)
    writeStore(key, result)
    if (token === changesToken) fillChanges(result, request.page)
  } catch {
    if (token !== changesToken) return
    state.textContent = 'GitHub can’t be reached right now.'
    more.hidden = false
    more.textContent = 'See the changes on GitHub'
    point(more, request.page)
  }
}

function setUpDownloads() {
  one('#builds-retry').addEventListener('click', () => {
    void loadBuilds(true)
  })
  one('#builds-more').addEventListener('click', () => {
    downloads.expanded = true
    renderList()
  })
  one('#tk-copy').addEventListener('click', () => {
    track('checksum_copied', { build: downloads.builds[selectedIndex()]?.short ?? '' })
    void copyDigest()
  })
  one('#tk-apk').addEventListener('click', () => {
    track('download_clicked', {
      build: downloads.builds[selectedIndex()]?.short ?? '',
      where: 'ticket',
    })
  })
  for (const link of every('a[data-latest-apk]')) {
    link.addEventListener('click', () => {
      const where = link.dataset['where'] ?? 'page'
      track('download_clicked', { build: downloads.builds[0]?.short ?? '', where })
    })
  }
  document.addEventListener('visibilitychange', () => {
    const stale = Date.now() - downloads.checkedAt > FRESH_MS
    if (document.visibilityState === 'visible' && stale && downloads.source !== 'loading')
      void loadBuilds()
  })
  // Until GitHub answers, show the last list this browser saw, or the saved one.
  const cached = readCachedBuilds()
  if (cached) downloads.builds = cached.builds
  downloads.selected = downloads.builds[0]?.tag ?? ''
  renderDownloads()
  void loadBuilds()
}

async function copyDigest() {
  const build = downloads.builds[selectedIndex()]
  const label = one('#tk-copy-label')
  if (!build?.digest) return
  try {
    await navigator.clipboard.writeText(build.digest)
    label.textContent = 'Copied'
  } catch {
    label.textContent = 'Select it to copy'
  }
}

// ── The player demo: the real loop's steps and wording, on the café set ──

const PHRASES = [
  { native: 'The bill, please', target: 'La cuenta, por favor', position: 3 },
  {
    native: 'Can we sit on the terrace?',
    target: '¿Nos podemos sentar en la terraza?',
    position: 4,
  },
  { native: 'Gluten-free, please', target: 'Sin gluten, por favor', position: 5 },
  { native: 'A cortado, please', target: 'Me pone un cortado, por favor', position: 1 },
  { native: 'Do you have oat milk?', target: '¿Tienen leche de avena?', position: 2 },
]
const STEP_MS = 1800
const RATE_STEP = 4

const demo = { phase: 0, index: 0, rated: '', paused: false, hold: 0 }
/** @type {Animation | null} */
let segment = null
let stepTimer = 0
let rateTimer = 0

function setUpDemo() {
  const screen = one('#demo')
  const steps = every('[data-step]', screen)
  const fills = every('[data-seg]', screen)
  const grades = every('[data-grade]', screen)
  const phrase = one('#demo-phrase')
  const playButton = one('#demo-play')

  function render() {
    const current = PHRASES[demo.index]
    if (!current) return
    const revealed = demo.phase >= 2 || demo.rated !== ''
    one('#demo-pos').textContent = `${current.position} of ${PHRASES.length}`
    steps.forEach((step, i) => {
      step.classList.toggle('on', i === demo.phase)
      step.classList.toggle('gone', i < demo.phase)
    })
    one('#demo-native').textContent = current.native
    const target = one('#demo-target')
    target.textContent = current.target
    target.classList.toggle('hid', !revealed)
    one('#demo-hidden').hidden = revealed
    fills.forEach((bar, i) => {
      bar.classList.toggle('done', i < demo.phase)
    })
    const listening = demo.rated === '' && (demo.phase === 0 || demo.phase === 2)
    const speaking = demo.rated === '' && (demo.phase === 1 || demo.phase === 3)
    one('#demo-wave').hidden = !listening
    one('#demo-speak').hidden = !speaking
    one('#demo-ask').hidden = demo.phase !== RATE_STEP || demo.rated !== ''
    for (const button of grades) {
      const grade = button.dataset['grade'] ?? ''
      button.classList.toggle('picked', demo.rated === grade)
      button.classList.toggle('ask', demo.phase === RATE_STEP && demo.rated === '')
    }
    one('#demo-toast').hidden = demo.rated === ''
    one('#demo-toast-title').textContent = `Rated ${demo.rated}`
    one('#demo-toast-sub').textContent =
      demo.rated === 'Easy' ? 'Next review scheduled' : 'Back at the end of this queue'
    screen.classList.toggle('paused', demo.paused)
    playButton.setAttribute('aria-label', demo.paused ? 'Play the demo' : 'Pause the demo')
    // The icons are SVG, not HTML elements: the attribute hides them (see [hidden] in the CSS).
    screen.querySelector('#demo-icon-play')?.toggleAttribute('hidden', !demo.paused)
    screen.querySelector('#demo-icon-pause')?.toggleAttribute('hidden', demo.paused)
  }

  function runSegment() {
    segment?.cancel()
    segment = null
    const bar = fills[demo.phase]
    if (!bar || demo.rated !== '') return
    segment = bar.animate([{ width: '0%' }, { width: '100%' }], {
      duration: STEP_MS,
      easing: 'linear',
      fill: 'forwards',
    })
    if (demo.paused) segment.pause()
  }

  function restart() {
    window.clearInterval(stepTimer)
    stepTimer = window.setInterval(tick, STEP_MS)
  }

  /** @param {number} step */
  function go(step) {
    demo.index = (demo.index + step + PHRASES.length) % PHRASES.length
    demo.phase = 0
    demo.rated = ''
    demo.hold = 0
    window.clearTimeout(rateTimer)
    render()
    runSegment()
    if (!reducedMotion.matches) {
      phrase.animate(
        [
          { opacity: 0, transform: 'translateX(28px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' },
      )
    }
    if (!demo.paused) restart()
  }

  function tick() {
    if (demo.paused || demo.rated !== '') return
    if (demo.phase < RATE_STEP) {
      demo.phase += 1
      render()
      runSegment()
      return
    }
    demo.hold += 1
    if (demo.hold >= 2) go(1)
  }

  for (const button of grades) {
    button.addEventListener('click', () => {
      demo.rated = button.dataset['grade'] ?? ''
      demo.phase = RATE_STEP
      render()
      runSegment()
      window.clearTimeout(rateTimer)
      rateTimer = window.setTimeout(() => {
        go(1)
      }, 1900)
    })
  }
  one('#demo-prev').addEventListener('click', () => {
    go(-1)
  })
  one('#demo-next').addEventListener('click', () => {
    go(1)
  })
  playButton.addEventListener('click', () => {
    demo.paused = !demo.paused
    track(demo.paused ? 'demo_paused' : 'demo_resumed', { step: demo.phase })
    if (demo.paused) segment?.pause()
    else {
      segment?.play()
      restart()
    }
    render()
  })

  render()
  runSegment()
  restart()
}

// ── The language drum ──

function setUpDrum() {
  const drum = one('#drum')
  const faces = every('[data-face]', drum)
  const pills = every('[data-course]')
  const count = faces.length
  let spin = 0
  let auto = true
  let resume = 0

  function render() {
    const front = ((spin % count) + count) % count
    drum.style.transform = `rotateX(${((-spin * 360) / count).toFixed(4)}deg)`
    faces.forEach((face, i) => {
      face.classList.toggle('on', i === front)
      face.setAttribute('aria-hidden', String(i !== front))
    })
    pills.forEach((pill, i) => {
      pill.classList.toggle('on', i === front)
      pill.setAttribute('aria-pressed', String(i === front))
    })
  }

  pills.forEach((pill, i) => {
    pill.addEventListener('click', () => {
      track('course_picked', { course: pill.textContent.trim() })
      const front = ((spin % count) + count) % count
      const forward = (i - front + count) % count
      spin += forward <= count / 2 ? forward : forward - count
      auto = false
      window.clearTimeout(resume)
      resume = window.setTimeout(() => {
        auto = true
      }, 9000)
      render()
    })
  })
  window.setInterval(() => {
    if (!auto || reducedMotion.matches || document.hidden) return
    spin += 1
    render()
  }, 2600)
  render()
}

// ── The film ──

function setUpFilm() {
  const video = one('#film video')
  if (!(video instanceof HTMLVideoElement)) return
  video.addEventListener(
    'play',
    () => {
      track('film_played')
    },
    { once: true },
  )
  video.addEventListener(
    'ended',
    () => {
      track('film_finished')
    },
    { once: true },
  )
}

// ── Decoration: bars, marquees and the pointer tilt ──

function setUpBars() {
  for (const box of every('[data-bars]')) {
    const count = Number(box.dataset['bars'] ?? '0')
    const seed = Number(box.dataset['seed'] ?? '7')
    const className = box.dataset['barClass'] ?? ''
    const bars = Array.from({ length: count }, (_, i) => {
      const bar = document.createElement('span')
      if (className) bar.className = className
      bar.style.height = `${22 + ((i * seed + 7) % 70)}%`
      bar.style.animationDelay = `-${(((i * 29 + seed) % 100) / 100).toFixed(2)}s`
      return bar
    })
    box.replaceChildren(...bars)
  }
}

function setUpMarquees() {
  for (const track of every('[data-marquee]')) {
    const copies = [...track.children].map((item) => {
      const copy = item.cloneNode(true)
      if (copy instanceof HTMLElement) copy.setAttribute('aria-hidden', 'true')
      return copy
    })
    track.append(...copies)
  }
}

function setUpTilt() {
  for (const element of every('[data-tilt]')) {
    element.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
      const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
      element.style.setProperty('--px', x.toFixed(3))
      element.style.setProperty('--py', y.toFixed(3))
      element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
      element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    })
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--px', '0.5')
      element.style.setProperty('--py', '0.5')
    })
  }
}

// The downloads first: they are what the page is for, and a fault in a decoration never stops them.
for (const setUp of [
  setUpDownloads,
  setUpAnalytics,
  setUpFilm,
  setUpBars,
  setUpMarquees,
  setUpTilt,
  setUpDemo,
  setUpDrum,
]) {
  try {
    setUp()
  } catch (error) {
    console.error(error)
  }
}
