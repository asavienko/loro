import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  filenameFor,
  formatSummary,
  htmlProblem,
  pngProblem,
  stateArtifactProblem,
  validatePassedStates,
  writeArtifacts,
} from './screenshots-artifacts.mjs'

test('filenameFor keeps a stable slug and accepts an extension', () => {
  assert.equal(filenameFor('today · seeded'), 'today-seeded-b843112d.png')
  assert.equal(filenameFor('today · seeded', 'html'), 'today-seeded-b843112d.html')
})

test('pngProblem and htmlProblem reject missing or malformed artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loro-screenshots-'))
  assert.match(pngProblem(join(dir, 'missing.png')), /without writing its PNG/)
  assert.match(htmlProblem(join(dir, 'missing.html')), /without writing its HTML/)

  writeFileSync(
    join(dir, 'tiny.png'),
    Buffer.from('89504e470d0a1a0a00000000000000000000000100000001', 'hex'),
  )
  assert.match(pngProblem(join(dir, 'tiny.png')), /Expected 390×844/)

  writeFileSync(join(dir, 'ok.png'), fixturePngBuffer())
  assert.equal(pngProblem(join(dir, 'ok.png')), undefined)

  writeFileSync(join(dir, 'note.txt'), 'not html')
  assert.match(htmlProblem(join(dir, 'note.txt')), /not an HTML document/)

  writeFileSync(join(dir, 'short.html'), '<!doctype html><html><body>x</body></html>\n')
  assert.match(htmlProblem(join(dir, 'short.html')), /empty/)

  writeFileSync(join(dir, 'ok.html'), validHtml())
  assert.equal(htmlProblem(join(dir, 'ok.html')), undefined)

  writeFileSync(
    join(dir, 'boot.html'),
    `${validHtml().replace('<body>', '<body><noscript>You need to enable JavaScript to run this app.</noscript>')}`,
  )
  assert.match(htmlProblem(join(dir, 'boot.html')), /noscript/)

  writeFileSync(
    join(dir, 'server.html'),
    validHtml().replace(
      '<h1>Today</h1>',
      '<img src="http://127.0.0.1:8086/icon.png"><h1>Today</h1>',
    ),
  )
  assert.match(htmlProblem(join(dir, 'server.html')), /capture server/)

  writeFileSync(
    join(dir, 'rooted.html'),
    validHtml().replace('<h1>Today</h1>', '<img src="/assets/icon.png"><h1>Today</h1>'),
  )
  assert.match(htmlProblem(join(dir, 'rooted.html')), /root-absolute/)
})

test('writeArtifacts emits portable image and HTML folders', () => {
  const runDir = mkdtempSync(join(tmpdir(), 'loro-screenshots-run-'))
  const image = `images/${filenameFor('today · seeded', 'png')}`
  const html = `html/${filenameFor('today · seeded', 'html')}`
  mkdirSync(join(runDir, 'images'), { recursive: true })
  mkdirSync(join(runDir, 'html'), { recursive: true })
  writeFileSync(join(runDir, image), fixturePngBuffer())
  writeFileSync(join(runDir, html), validHtml())

  const manifest = {
    status: 'passed',
    counts: { passed: 1, failed: 0, 'not-run': 0 },
    states: [
      {
        name: 'today · seeded',
        route: '/',
        spec: '§11 Today',
        image,
        html,
        status: 'passed',
      },
    ],
  }

  writeArtifacts(runDir, manifest)

  const hub = readFileSync(join(runDir, 'index.html'), 'utf8')
  const images = readFileSync(join(runDir, 'images', 'index.html'), 'utf8')
  const screens = readFileSync(join(runDir, 'html', 'index.html'), 'utf8')

  assert.match(hub, /<base href="\.\/">/)
  assert.match(hub, /\.\/images\/index\.html/)
  assert.match(hub, /\.\/html\/index\.html/)
  assert.match(images, /\.\/today-seeded-b843112d\.png/)
  assert.doesNotMatch(images, /<iframe /)
  assert.match(screens, /\.\/today-seeded-b843112d\.html/)
  assert.match(screens, /srcdoc=/)
  assert.match(screens, /Me pone un cortado/)
  assert.doesNotMatch(screens, /screens\//)
  assert.doesNotMatch(screens, / src="/)

  const exported = mkdtempSync(join(tmpdir(), 'loro-screenshots-export-'))
  cpSync(join(runDir, 'html'), join(exported, 'html'), { recursive: true })
  cpSync(join(runDir, 'images'), join(exported, 'images'), { recursive: true })
  cpSync(join(runDir, 'index.html'), join(exported, 'index.html'))
  assert.equal(existsSync(join(exported, 'html', filenameFor('today · seeded', 'html'))), true)
  assert.equal(existsSync(join(exported, 'images', filenameFor('today · seeded', 'png'))), true)
  const exportedGallery = readFileSync(join(exported, 'html', 'index.html'), 'utf8')
  assert.match(exportedGallery, /\.\/today-seeded-b843112d\.html/)
  assert.match(exportedGallery, /srcdoc=/)

  const summary = formatSummary(runDir, manifest)
  assert.match(summary, /Screen artifacts: 1 passed/)
  assert.match(summary, /Images: .*images\/index\.html/)
  assert.match(summary, /HTML: .*html\/index\.html/)
})

test('a passed state without HTML is failed closed', () => {
  const runDir = mkdtempSync(join(tmpdir(), 'loro-screenshots-html-'))
  mkdirSync(join(runDir, 'images'), { recursive: true })
  const image = `images/${filenameFor('today · seeded', 'png')}`
  writeFileSync(join(runDir, image), fixturePngBuffer())
  const manifest = {
    status: 'passed',
    states: [
      {
        name: 'today · seeded',
        route: '/',
        spec: '§11 Today',
        image,
        html: `html/${filenameFor('today · seeded', 'html')}`,
        status: 'passed',
      },
    ],
  }
  assert.match(stateArtifactProblem(runDir, manifest.states[0]), /without writing its HTML/)
  validatePassedStates(runDir, manifest)
  assert.equal(manifest.states[0].status, 'failed')
})

function fixturePngBuffer() {
  const png = Buffer.alloc(24)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png)
  png.writeUInt32BE(390, 16)
  png.writeUInt32BE(844, 20)
  return png
}

function validHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><base href="./"><title>Today</title></head>
<body><main><h1>Today</h1><p>Me pone un cortado ${'phrase '.repeat(40)}</p></main></body></html>
`
}
