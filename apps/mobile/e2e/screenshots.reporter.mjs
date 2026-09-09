import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default class ScreenshotReporter {
  constructor({ runDir }) {
    this.runDir = runDir
  }

  onTestEnd(test, result) {
    const prefix = 'capture: '
    if (!test.title.startsWith(prefix)) return
    const name = test.title.slice(prefix.length)
    const manifest = this.readManifest()
    const entry = manifest.states.find((state) => state.name === name)
    if (entry === undefined) return

    entry.status = result.status === 'passed' ? 'passed' : 'failed'
    if (result.errors.length > 0)
      entry.error = result.errors.map((error) => error.message ?? String(error)).join('\n\n')
    this.writeManifest(manifest)
  }

  onEnd() {
    const manifest = this.readManifest()
    for (const entry of manifest.states) {
      if (entry.status !== 'passed') continue
      const problem = pngProblem(join(this.runDir, entry.image))
      if (problem !== undefined) {
        entry.status = 'failed'
        entry.error = problem
      }
    }

    const counts = manifest.states.reduce(
      (totals, state) => ({ ...totals, [state.status]: totals[state.status] + 1 }),
      { passed: 0, failed: 0, 'not-run': 0 },
    )
    manifest.status =
      manifest.error === undefined && counts.failed === 0 && counts['not-run'] === 0
        ? 'passed'
        : 'failed'
    manifest.completedAt = new Date().toISOString()
    manifest.counts = counts
    this.writeManifest(manifest)
    writeFileSync(join(this.runDir, 'index.html'), gallery(manifest))
    console.log(
      `${manifest.error === undefined ? 'Screen images' : 'Screen image setup failed'}: ${counts.passed} passed, ${counts.failed} failed, ${counts['not-run']} not run.\nGallery: ${join(this.runDir, 'index.html')}`,
    )
    return manifest.status === 'passed' ? undefined : { status: 'failed' }
  }

  readManifest() {
    return JSON.parse(readFileSync(join(this.runDir, 'manifest.json'), 'utf8'))
  }

  writeManifest(manifest) {
    writeFileSync(join(this.runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function pngProblem(path) {
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

function gallery(manifest) {
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
  const counts = manifest.counts ?? { passed: 0, failed: 0, 'not-run': manifest.states.length }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Loro screen images</title><style>
body{margin:24px;background:#f7f4ef;color:#211f1c;font:15px/1.45 system-ui,sans-serif}h1{margin-bottom:0}section{margin:36px 0}.grid{display:flex;flex-wrap:wrap;gap:20px}.card{width:240px}.card img,.missing{box-sizing:border-box;width:240px;height:520px;border:1px solid #c9c2b8;border-radius:16px;background:#fff;object-fit:contain}.missing{display:grid;place-items:center;padding:16px}.meta{margin:8px 0 0}.status{font-weight:700}.passed{color:#176b3a}.failed,.not-run{color:#a63329}pre{white-space:pre-wrap;font-size:12px}</style></head>
<body><h1>Loro screen images</h1><p>${escapeHtml(manifest.status)} · ${counts.passed} passed · ${counts.failed} failed · ${counts['not-run']} not run</p>${sections}</body></html>`
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
