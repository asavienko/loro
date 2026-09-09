import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function ensureRunDirectory(runDir) {
  mkdirSync(join(runDir, 'images'), { recursive: true })
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
      viewport: { width: 390, height: 844 },
    },
    states: states.map((state) => ({
      name: state.name,
      route: state.route,
      spec: state.spec,
      image: `images/${filenameFor(state.name)}`,
      status: 'not-run',
    })),
  }
}

export function writeManifest(runDir, manifest) {
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export function finalizeManifest(runDir, manifest) {
  manifest.completedAt = new Date().toISOString()
  manifest.counts = countStates(manifest.states)
  writeManifest(runDir, manifest)
  writeGallery(runDir, manifest)
  return manifest
}

export function formatSummary(runDir, manifest) {
  const counts = manifest.counts ?? countStates(manifest.states)
  const label = manifest.status === 'passed' ? 'Screen images' : 'Screen image run failed'
  const error = manifest.error === undefined ? '' : `\nError: ${manifest.error}`
  return `${label}: ${counts.passed} passed, ${counts.failed} failed, ${counts['not-run']} not run.${error}\nGallery: ${join(runDir, 'index.html')}`
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
  return width === 390 && height === 844
    ? undefined
    : `Expected 390×844 PNG, received ${width}×${height}.`
}

export function filenameFor(name) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619)
  return `${slug || 'state'}-${(hash >>> 0).toString(16).padStart(8, '0')}.png`
}

export function writeGallery(runDir, manifest) {
  const grouped = new Map()
  for (const state of manifest.states) {
    const states = grouped.get(state.route) ?? []
    states.push(state)
    grouped.set(state.route, states)
  }
  const sections = [...grouped.entries()]
    .map(
      ([route, states]) =>
        `<section><h2>${escapeHtml(route)}</h2><div class="grid">${states
          .map((state) => card(state))
          .join('')}</div></section>`,
    )
    .join('')
  const counts = manifest.counts ?? countStates(manifest.states)
  const error = manifest.error === undefined ? '' : `<pre>${escapeHtml(manifest.error)}</pre>`
  const body = `${escapeHtml(manifest.status)} · ${counts.passed} passed · ${counts.failed} failed · ${counts['not-run']} not run${error}`
  writeFileSync(
    join(runDir, 'index.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Loro screen images</title><style>
body{margin:24px;background:#f7f4ef;color:#211f1c;font:15px/1.45 system-ui,sans-serif}h1{margin-bottom:0}section{margin:36px 0}.grid{display:flex;flex-wrap:wrap;gap:20px}.card{width:240px}.card img,.missing{box-sizing:border-box;width:240px;height:520px;border:1px solid #c9c2b8;border-radius:16px;background:#fff;object-fit:contain}.missing{display:grid;place-items:center;padding:16px}.meta{margin:8px 0 0}.status{font-weight:700}.passed{color:#176b3a}.failed,.not-run{color:#a63329}pre{white-space:pre-wrap;font-size:12px}</style></head>
<body><h1>Loro screen images</h1><p>${body}</p>${sections}</body></html>`,
  )
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

function card(state) {
  const image =
    state.status === 'passed'
      ? `<a href="${encodeURI(state.image)}"><img src="${encodeURI(state.image)}" alt="${escapeHtml(state.name)}"></a>`
      : `<div class="missing">No image</div>`
  const error = state.error === undefined ? '' : `<pre>${escapeHtml(state.error)}</pre>`
  return `<article class="card">${image}<div class="meta"><strong>${escapeHtml(state.name)}</strong><br><span class="status ${state.status}">${escapeHtml(state.status)}</span><br><small>${escapeHtml(state.spec)}</small>${error}</div></article>`
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  )
}
