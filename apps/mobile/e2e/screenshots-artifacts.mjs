import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { filenameFor } from './screenshots-filename.mjs'

export { filenameFor }

const VIEWPORT = { width: 390, height: 844 }

export function ensureRunDirectory(runDir) {
  mkdirSync(join(runDir, 'images'), { recursive: true })
  mkdirSync(join(runDir, 'html'), { recursive: true })
  mkdirSync(join(runDir, 'diagnostics'), { recursive: true })
}

/** Build the complete expected-state manifest before Playwright starts any server. */
export function initialManifest(repository) {
  runChecked(repository, ['scripts/check-routes.mjs'])
  const states = JSON.parse(runChecked(repository, ['scripts/list-e2e-states.mjs']))
  return {
    version: 1,
    status: 'running',
    run: {
      startedAt: new Date().toISOString(),
      fixedTime: '2026-09-09T10:00:00 Europe/Madrid',
      revision: git(repository, ['rev-parse', 'HEAD']),
      dirty: git(repository, ['status', '--porcelain']).length > 0,
      browser: { name: null, version: null },
      viewport: VIEWPORT,
    },
    artifacts: {
      hub: 'index.html',
      images: 'images/index.html',
      html: 'html/index.html',
    },
    states: states.map((state) => ({
      name: state.name,
      route: state.route,
      spec: state.spec,
      image: `images/${filenameFor(state.name, 'png')}`,
      html: `html/${filenameFor(state.name, 'html')}`,
      status: 'not-run',
    })),
  }
}

export function writeManifest(runDir, manifest) {
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export function finalizeManifest(runDir, manifest) {
  validatePassedStates(runDir, manifest)
  manifest.completedAt = new Date().toISOString()
  manifest.counts = countStates(manifest.states)
  if (
    manifest.status === 'passed' &&
    (manifest.error !== undefined || manifest.counts.failed > 0 || manifest.counts['not-run'] > 0)
  )
    manifest.status = 'failed'
  writeManifest(runDir, manifest)
  writeArtifacts(runDir, manifest)
  return manifest
}

export function formatSummary(runDir, manifest) {
  const counts = manifest.counts ?? countStates(manifest.states)
  const label = manifest.status === 'passed' ? 'Screen artifacts' : 'Screen artifact run failed'
  const error = manifest.error === undefined ? '' : `\nError: ${manifest.error}`
  return `${label}: ${counts.passed} passed, ${counts.failed} failed, ${counts['not-run']} not run.${error}
Hub: ${join(runDir, 'index.html')}
Images: ${join(runDir, 'images', 'index.html')}
HTML: ${join(runDir, 'html', 'index.html')}`
}

export function readManifest(runDir) {
  return JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8'))
}

export function failedManifest(message, existing) {
  const manifest = existing ?? {
    version: 1,
    run: {
      startedAt: new Date().toISOString(),
      browser: { name: null, version: null },
    },
    artifacts: {
      hub: 'index.html',
      images: 'images/index.html',
      html: 'html/index.html',
    },
    states: [],
  }
  manifest.status = 'failed'
  manifest.error = message
  return manifest
}

export function pngProblem(path) {
  if (!existsSync(path)) return 'The capture test finished without writing its PNG.'
  const png = readFileSync(path)
  if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    return 'The capture artifact is not a PNG.'
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  return width === VIEWPORT.width && height === VIEWPORT.height
    ? undefined
    : `Expected ${VIEWPORT.width}×${VIEWPORT.height} PNG, received ${width}×${height}.`
}

export function htmlProblem(path) {
  if (!existsSync(path)) return 'The capture test finished without writing its HTML.'
  const html = readFileSync(path, 'utf8')
  if (!/^<!doctype html\b/i.test(html.trimStart()))
    return 'The capture artifact is not an HTML document.'
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html))
    return 'The HTML snapshot is missing a document root.'
  if (html.length < 200) return 'The HTML snapshot is empty.'
  if (/<noscript[\s>]/i.test(html) || /<script[\s>]/i.test(html))
    return 'The HTML snapshot still contains executable or noscript chrome.'
  if (!/<base\s+href=["']\.\/["']/i.test(html))
    return 'The HTML snapshot is missing a relative base href.'
  if (/https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])/i.test(html))
    return 'The HTML snapshot still points at the capture server.'
  if (/(?:src|href)=["']\//i.test(html) || /url\(\s*(['"]?)\//i.test(html))
    return 'The HTML snapshot still uses root-absolute paths.'
  return undefined
}

export function stateArtifactProblem(runDir, state) {
  const problems = [
    state.image ? pngProblem(join(runDir, state.image)) : 'The state has no image path.',
    state.html ? htmlProblem(join(runDir, state.html)) : 'The state has no HTML path.',
  ].filter((problem) => problem !== undefined)
  return problems.length === 0 ? undefined : problems.join(' ')
}

export function validatePassedStates(runDir, manifest) {
  for (const state of manifest.states) {
    if (state.status !== 'passed') continue
    const problem = stateArtifactProblem(runDir, state)
    if (problem !== undefined) {
      state.status = 'failed'
      state.error = problem
    }
  }
}

export function writeArtifacts(runDir, manifest) {
  writeHub(runDir, manifest)
  writeImageGallery(runDir, manifest)
  writeHtmlGallery(runDir, manifest)
}

export function writeGallery(runDir, manifest) {
  writeArtifacts(runDir, manifest)
}

function runChecked(cwd, args) {
  try {
    return execFileSync(process.execPath, args, { cwd, encoding: 'utf8' }).trim()
  } catch (error) {
    const stderr = error?.stderr?.toString().trim()
    throw new Error(stderr || error?.message || String(error))
  }
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function countStates(states) {
  return states.reduce(
    (totals, state) => ({ ...totals, [state.status]: totals[state.status] + 1 }),
    { passed: 0, failed: 0, 'not-run': 0 },
  )
}

function groupedStates(manifest) {
  const grouped = new Map()
  for (const state of manifest.states) {
    const states = grouped.get(state.route) ?? []
    states.push(state)
    grouped.set(state.route, states)
  }
  return [...grouped.entries()]
}

function statusLine(manifest) {
  const counts = manifest.counts ?? countStates(manifest.states)
  const error = manifest.error === undefined ? '' : `<pre>${escapeHtml(manifest.error)}</pre>`
  return `${escapeHtml(manifest.status)} · ${counts.passed} passed · ${counts.failed} failed · ${counts['not-run']} not run${error}`
}

function routeNav(groups) {
  if (groups.length === 0) return ''
  return `<nav class="toc">${groups
    .map(([route]) => `<a href="#${escapeHtml(routeId(route))}">${escapeHtml(route)}</a>`)
    .join('')}</nav>`
}

function routeId(route) {
  return `route-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'}`
}

function writeHub(runDir, manifest) {
  const counts = manifest.counts ?? countStates(manifest.states)
  writeFileSync(
    join(runDir, 'index.html'),
    document({
      title: 'Loro screen artifacts',
      heading: 'Loro screen artifacts',
      intro: `${statusLine(manifest)}
<p class="lead">One capture run writes two reviewable artifacts: the PNG gallery and the HTML snapshots of every learner-visible state.</p>
<div class="artifacts">
  <article class="artifact">
    <h2>Images</h2>
    <p>${counts.passed} of ${manifest.states.length} states as 390 × 844 PNGs.</p>
    <p><a href="./images/index.html">Open the image gallery</a></p>
  </article>
  <article class="artifact">
    <h2>HTML</h2>
    <p>${counts.passed} of ${manifest.states.length} states as standalone HTML documents.</p>
    <p><a href="./html/index.html">Open the HTML gallery</a></p>
  </article>
</div>`,
      extra: `.lead{max-width:40rem}.artifacts{display:flex;flex-wrap:wrap;gap:20px;margin-top:28px}.artifact{flex:1 1 280px;padding:20px;border:1px solid #c9c2b8;border-radius:16px;background:#fff}`,
    }),
  )
}

function writeImageGallery(runDir, manifest) {
  const groups = groupedStates(manifest)
  const sections = groups
    .map(
      ([route, states]) =>
        `<section id="${escapeHtml(routeId(route))}"><h2>${escapeHtml(route)}</h2><div class="grid">${states
          .map((state) => imageCard(state))
          .join('')}</div></section>`,
    )
    .join('')
  writeFileSync(
    join(runDir, 'images', 'index.html'),
    document({
      title: 'Loro screen images',
      heading: 'Loro screen images',
      intro: `${statusLine(manifest)}${routeNav(groups)}<p class="lead">390 × 844 PNG of every declared learner state. Open a phone to see the full-size image.</p>`,
      body: sections,
    }),
  )
}

function writeHtmlGallery(runDir, manifest) {
  const groups = groupedStates(manifest)
  const sections = groups
    .map(
      ([route, states]) =>
        `<section id="${escapeHtml(routeId(route))}"><h2>${escapeHtml(route)}</h2><div class="grid">${states
          .map((state) => htmlCard(runDir, state))
          .join('')}</div></section>`,
    )
    .join('')
  writeFileSync(
    join(runDir, 'html', 'index.html'),
    document({
      title: 'Loro screen HTML',
      heading: 'Loro screen HTML',
      intro: `${statusLine(manifest)}${routeNav(groups)}<p class="lead">The reached DOM of every declared learner state, frozen as a portable HTML document. Copy this folder and open a phone to open its sibling file.</p>`,
      body: sections,
    }),
  )
}

function siblingHref(path) {
  return `./${encodeURI(basename(path ?? ''))}`
}

function imageCard(state) {
  const href = siblingHref(state.image)
  const preview =
    state.status === 'passed'
      ? `<a class="phone" href="${href}"><span class="phone-screen"><img src="${href}" alt="${escapeHtml(state.name)}"></span></a>`
      : `<div class="phone"><div class="phone-screen missing">No image</div></div>`
  return card(state, preview)
}

function htmlCard(runDir, state) {
  const href = siblingHref(state.html)
  const preview =
    state.status === 'passed' && state.html !== undefined && existsSync(join(runDir, state.html))
      ? `<a class="phone" href="${href}"><span class="phone-screen missing">Open HTML</span></a>`
      : `<div class="phone"><div class="phone-screen missing">No HTML</div></div>`
  return card(state, preview)
}

function card(state, preview) {
  const error = state.error === undefined ? '' : `<pre>${escapeHtml(state.error)}</pre>`
  return `<article class="card">${preview}<div class="meta"><strong>${escapeHtml(state.name)}</strong><br><span class="status ${state.status}">${escapeHtml(state.status)}</span><br><small>${escapeHtml(state.spec)}</small>${error}</div></article>`
}

function document({ title, heading, intro, body = '', extra = '' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><base href="./"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>
body{margin:24px;background:#f7f4ef;color:#211f1c;font:15px/1.45 system-ui,sans-serif}h1{margin-bottom:8px}h2{margin:0 0 16px}.lead{max-width:44rem}section{margin:36px 0;scroll-margin-top:16px}.toc{display:flex;flex-wrap:wrap;gap:8px 16px;margin:16px 0 8px}.toc a{color:#5c3d14}.grid{display:flex;flex-wrap:wrap;gap:24px}.card{width:206px}.phone{display:block;box-sizing:border-box;width:206px;height:438px;padding:8px;border-radius:28px;background:#211f1c;text-decoration:none}.phone-screen{display:block;position:relative;width:190px;height:422px;overflow:hidden;border-radius:20px;background:#fff}.phone-screen img{position:absolute;top:0;left:0;width:390px;height:844px;border:0;transform:scale(0.487);transform-origin:top left;pointer-events:none}.missing{display:grid;place-items:center;padding:16px;color:#211f1c}.meta{margin:10px 0 0}.status{font-weight:700}.passed{color:#176b3a}.failed,.not-run{color:#a63329}pre{white-space:pre-wrap;font-size:12px}${extra}
</style></head>
<body><h1>${escapeHtml(heading)}</h1>${intro}${body}</body></html>
`
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  )
}
