/**
 * Drive plan 101/93 wave-path rows on an Android device through adb + uiautomator.
 *
 * A screenshot of whatever is on screen is not a pass. Missing SDK, adb, or device
 * stays unavailable. Dump-only evaluation never marks a row passed.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { unevaluatedWaveScenarios, WAVE_TOUCH_SCENARIOS } from './wave-touch-scenarios.mjs'

export const WAVE_SCENARIO_IDS = WAVE_TOUCH_SCENARIOS.map((row) => row.id)

const STREAM_PRACTICE = 'Practice this phrase'
const STREAM_WAVE = 'This wave'
const PHRASE_FOCUS = 'This phrase'
const HARD_FOCUS = 'Difficult phrases'
const HARD_EMPTY = 'No difficult phrases yet'
const REFRAIN_TITLE = 'The Refrain'
const STREAM_TITLE = 'The Stream'
const MENU_OPEN = 'open the menu'
const WAVE_START = /^Start the (morning|midday|evening) wave$/
const KEEP_LISTENING = 'Keep listening'

export function parseBounds(value) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(value ?? '')
  if (!match) return null
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  }
}

export function parseUiDump(xml) {
  const nodes = []
  for (const tag of xml.matchAll(/<node\b[^>]*>/g)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([A-Za-z0-9:-]+)="([^"]*)"/g)].map((entry) => [entry[1], entry[2]]),
    )
    nodes.push({
      text: attrs.text ?? '',
      contentDesc: attrs['content-desc'] ?? '',
      clickable: attrs.clickable === 'true',
      bounds: parseBounds(attrs.bounds),
    })
  }
  return { xml, nodes }
}

function nodeLabel(node) {
  return `${node.text} ${node.contentDesc}`
}

export function findLabel(dump, label) {
  const parsed = typeof dump === 'string' ? parseUiDump(dump) : dump
  const exact = parsed.nodes.find((node) => node.text === label || node.contentDesc === label)
  if (exact) return exact
  return parsed.nodes.find((node) => nodeLabel(node).includes(label))
}

function nodePrimaryLabel(node) {
  return node.text || node.contentDesc || ''
}

/** Today's filled wave control — Start the * wave, or Keep listening once slots are done. */
export function findWaveStart(dump) {
  const parsed = typeof dump === 'string' ? parseUiDump(dump) : dump
  return parsed.nodes.find((node) => {
    const label = nodePrimaryLabel(node)
    return WAVE_START.test(label) || label === KEEP_LISTENING
  })
}

export function dumpHas(dump, label) {
  return findLabel(dump, label) !== undefined
}

export function tapBounds(dump, label) {
  const node = findLabel(dump, label)
  if (!node?.bounds) return null
  const { left, top, right, bottom } = node.bounds
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) }
}

function parseAppUrl(url) {
  if (!url) return null
  try {
    if (url.startsWith('/')) return new URL(`https://loro.invalid${url}`)
    if (url.startsWith('loro://') || url.startsWith('loro-dev://')) {
      return new URL(url.replace(/^loro(?:-dev)?:\/\//, 'https://loro.invalid/'))
    }
    return new URL(url)
  } catch {
    return null
  }
}

export function isPhraseRefrainUrl(url) {
  const parsed = parseAppUrl(url)
  return Boolean(
    parsed?.pathname.endsWith('/practice/refrain') && parsed.searchParams.get('phrase'),
  )
}

export function isHardRefrainUrl(url) {
  const parsed = parseAppUrl(url)
  return Boolean(
    parsed?.pathname.endsWith('/practice/refrain') && parsed.searchParams.get('filter') === 'hard',
  )
}

export function isStreamUrl(url) {
  const parsed = parseAppUrl(url)
  return Boolean(parsed?.pathname.endsWith('/practice/stream'))
}

export function isPracticeUrl(url) {
  const parsed = parseAppUrl(url)
  return Boolean(
    parsed?.pathname.endsWith('/practice/stream') || parsed?.pathname.endsWith('/practice/refrain'),
  )
}

function isPhraseChrome(dump) {
  return dumpHas(dump, PHRASE_FOCUS) && dumpHas(dump, REFRAIN_TITLE)
}

function isHardChrome(dump) {
  return dumpHas(dump, REFRAIN_TITLE) && (dumpHas(dump, HARD_FOCUS) || dumpHas(dump, HARD_EMPTY))
}

function isStreamChrome(dump) {
  return dumpHas(dump, STREAM_PRACTICE) || dumpHas(dump, STREAM_WAVE) || dumpHas(dump, STREAM_TITLE)
}

function isPracticeChrome(dump) {
  return (
    isStreamChrome(dump) ||
    isPhraseChrome(dump) ||
    isHardChrome(dump) ||
    dumpHas(dump, REFRAIN_TITLE)
  )
}

export function evaluateTodayStreamDump({ todayDump, streamDump, currentUrl }) {
  if (!findWaveStart(todayDump)) {
    return {
      status: 'failed',
      notes: 'Today dump does not expose Start the * wave or Keep listening.',
    }
  }
  if (!currentUrl) {
    return {
      status: 'unavailable',
      notes: 'Dump-only path cannot prove /practice/stream from Today.',
    }
  }
  if (!isStreamUrl(currentUrl) || !isStreamChrome(streamDump)) {
    return {
      status: 'failed',
      notes: `Expected Stream after the Today wave control; landed ${currentUrl || 'unknown'}.`,
    }
  }
  return {
    status: 'passed',
    notes: 'Today wave control opened Stream.',
  }
}

export function evaluateStreamPhraseDump({ streamDump, refrainDump, currentUrl }) {
  if (!dumpHas(streamDump, STREAM_PRACTICE)) {
    return {
      status: 'failed',
      notes: 'Stream dump does not expose Practice this phrase.',
    }
  }
  if (!currentUrl) {
    return {
      status: 'unavailable',
      notes: 'Dump-only path cannot prove /practice/refrain?phrase=<id>.',
    }
  }
  if (isStreamUrl(currentUrl) || !isPhraseRefrainUrl(currentUrl) || !isPhraseChrome(refrainDump)) {
    return {
      status: 'failed',
      notes: `Expected phrase focus after the Stream control; landed ${currentUrl || 'unknown'}.`,
    }
  }
  return {
    status: 'passed',
    notes: 'Stream Practice this phrase opened phrase focus.',
  }
}

export function evaluateHardRefrainDump({ menuDump, refrainDump, currentUrl }) {
  if (!dumpHas(menuDump, REFRAIN_TITLE)) {
    return {
      status: 'failed',
      notes: 'Menu dump does not expose The Refrain.',
    }
  }
  if (!currentUrl) {
    return {
      status: 'unavailable',
      notes: 'Dump-only path cannot prove /practice/refrain?filter=hard.',
    }
  }
  if (!isHardRefrainUrl(currentUrl) || !isHardChrome(refrainDump) || isPhraseChrome(refrainDump)) {
    return {
      status: 'failed',
      notes: `Expected hard-filter Refrain; landed ${currentUrl || 'unknown'}.`,
    }
  }
  return {
    status: 'passed',
    notes: 'Menu The Refrain opened the difficult-only drill.',
  }
}

export function evaluatePracticeGestureDisabledDump({ dump, currentUrl }) {
  const onPractice = isPracticeChrome(dump) || isPracticeUrl(currentUrl)
  return {
    status: 'unavailable',
    notes: onPractice
      ? 'Dump shows a practice session; a screenshot cannot prove gestureEnabled: false. Execute the edge-swipe row on a device.'
      : 'Dump is not a practice session; gestureEnabled: false is not evidenced.',
  }
}

export function evaluatePracticeBackSwipe({ beforeDump, afterDump }) {
  if (!isPracticeChrome(beforeDump)) {
    return {
      status: 'unavailable',
      notes: 'Back-swipe probe never reached Stream or Refrain.',
    }
  }
  if (!isPracticeChrome(afterDump)) {
    return {
      status: 'failed',
      notes: 'Edge swipe left the practice session.',
    }
  }
  return {
    status: 'passed',
    notes: 'Edge swipe left Stream/Refrain on the session.',
  }
}

function runCommand(run, adb, serial, args) {
  const argv = serial ? ['-s', serial, ...args] : args
  return run(adb, argv, { encoding: 'utf8' })
}

function failedCommand(result, label) {
  if (result.error) return `${label} unavailable: ${result.error.code || result.error.message}`
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n')[0]
    return `${label} failed: ${detail}`
  }
  return null
}

export function probeAndroidDevice({ adb = 'adb', serial, run = spawnSync } = {}) {
  const version = run(adb, ['version'], { encoding: 'utf8' })
  const missing = failedCommand(version, 'adb')
  if (missing) {
    return {
      reason:
        'adb is not installed on this host. Plan 101 wave-path rows stay unavailable; browser Playwright is not native evidence.',
    }
  }
  const devices = runCommand(run, adb, undefined, ['devices', '-l'])
  const deviceError = failedCommand(devices, 'adb devices')
  if (deviceError) return { reason: deviceError }
  const selected =
    serial ||
    devices.stdout
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts[0] && parts[1] === 'device')?.[0]
  if (!selected) {
    return {
      reason:
        'No authorized Android device. Plan 101 wave-path rows stay unavailable until a device run drives them.',
    }
  }
  return { serial: selected }
}

function waitForUi(_run, ms) {
  if (ms <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function dumpUi(ctx, name) {
  const dump = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'uiautomator',
    'dump',
    '/sdcard/loro-wave.xml',
  ])
  const dumpError = failedCommand(dump, 'uiautomator dump')
  if (dumpError) return { error: dumpError }
  const cat = runCommand(ctx.run, ctx.adb, ctx.serial, ['shell', 'cat', '/sdcard/loro-wave.xml'])
  const catError = failedCommand(cat, 'uiautomator cat')
  if (catError) return { error: catError }
  const xml = cat.stdout || ''
  if (ctx.outputDir) {
    mkdirSync(ctx.outputDir, { recursive: true })
    writeFileSync(resolve(ctx.outputDir, `${name}.xml`), xml)
  }
  return { xml }
}

function tapLabel(ctx, dump, label) {
  const point = tapBounds(dump, label)
  if (!point) return `Missing tap target: ${label}`
  const tap = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'input',
    'tap',
    String(point.x),
    String(point.y),
  ])
  return failedCommand(tap, `input tap ${label}`)
}

function tapWaveStart(ctx, dump) {
  const node = findWaveStart(dump)
  if (!node?.bounds) return 'Missing tap target: Start the * wave'
  const { left, top, right, bottom } = node.bounds
  const tap = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'input',
    'tap',
    String(Math.floor((left + right) / 2)),
    String(Math.floor((top + bottom) / 2)),
  ])
  return failedCommand(tap, 'input tap wave start')
}

function openDeepLink(ctx, path) {
  if (path === '/') {
    const started = runCommand(ctx.run, ctx.adb, ctx.serial, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.MAIN',
      '-c',
      'android.intent.category.LAUNCHER',
      ctx.packageName,
    ])
    return failedCommand(started, `am start ${ctx.packageName}`)
  }
  const uri = `${ctx.scheme}://${path.replace(/^\//, '')}`
  const started = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    uri,
    ctx.packageName,
  ])
  return failedCommand(started, `am start ${uri}`)
}

function currentActivityUrl(ctx) {
  const dump = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'dumpsys',
    'activity',
    'activities',
  ])
  if (failedCommand(dump, 'dumpsys activity')) return ''
  const text = dump.stdout || ''
  const match =
    text.match(/dat=(loro(?:-dev)?:\/\/[^\s]+)/) ||
    text.match(/(loro(?:-dev)?:\/\/[^\s]+)/) ||
    text.match(/(\/practice\/(?:stream|refrain)[^\s]*)/)
  return match?.[1] ?? ''
}

function scenarioResult(scenario, evaluation, extra = {}) {
  return {
    ...scenario,
    status: evaluation.status,
    reason: evaluation.notes,
    notes: evaluation.notes,
    ...extra,
  }
}

function runStreamPhrase(ctx) {
  const scenario = WAVE_TOUCH_SCENARIOS[0]
  const opened = openDeepLink(ctx, '/')
  if (opened) return scenarioResult(scenario, { status: 'unavailable', notes: opened })
  waitForUi(ctx.run, ctx.waitMs)
  const today = dumpUi(ctx, 'today-before')
  if (today.error) return scenarioResult(scenario, { status: 'unavailable', notes: today.error })
  const started = tapWaveStart(ctx, today.xml)
  if (started) return scenarioResult(scenario, { status: 'failed', notes: started })
  waitForUi(ctx.run, ctx.waitMs)
  const stream = dumpUi(ctx, 'stream-before')
  if (stream.error) return scenarioResult(scenario, { status: 'unavailable', notes: stream.error })
  const streamUrl = currentActivityUrl(ctx)
  const todayEval = evaluateTodayStreamDump({
    todayDump: today.xml,
    streamDump: stream.xml,
    currentUrl: streamUrl,
  })
  if (todayEval.status !== 'passed')
    return scenarioResult(scenario, todayEval, { currentUrl: streamUrl })
  const tapped = tapLabel(ctx, stream.xml, STREAM_PRACTICE)
  if (tapped) return scenarioResult(scenario, { status: 'failed', notes: tapped })
  waitForUi(ctx.run, ctx.waitMs)
  const refrain = dumpUi(ctx, 'stream-after')
  if (refrain.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: refrain.error })
  const currentUrl = currentActivityUrl(ctx)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, 'stream-url.txt'), `${currentUrl}\n`)
  }
  return scenarioResult(
    scenario,
    evaluateStreamPhraseDump({
      streamDump: stream.xml,
      refrainDump: refrain.xml,
      currentUrl,
    }),
    { currentUrl },
  )
}

function runHardEntry(ctx, { startPath, openMenu, prefix }) {
  const opened = openDeepLink(ctx, startPath)
  if (opened) return { status: 'unavailable', notes: opened }
  waitForUi(ctx.run, ctx.waitMs)
  let entry = dumpUi(ctx, `${prefix}-start`)
  if (entry.error) return { status: 'unavailable', notes: entry.error }
  if (openMenu) {
    const openedMenu = tapLabel(ctx, entry.xml, MENU_OPEN)
    if (openedMenu) return { status: 'failed', notes: openedMenu }
    waitForUi(ctx.run, ctx.waitMs)
    entry = dumpUi(ctx, `${prefix}-menu`)
    if (entry.error) return { status: 'unavailable', notes: entry.error }
  }
  const tapped = tapLabel(ctx, entry.xml, REFRAIN_TITLE)
  if (tapped) return { status: 'failed', notes: tapped }
  waitForUi(ctx.run, ctx.waitMs)
  const refrain = dumpUi(ctx, `${prefix}-after`)
  if (refrain.error) return { status: 'unavailable', notes: refrain.error }
  const currentUrl = currentActivityUrl(ctx)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, `${prefix}-url.txt`), `${currentUrl}\n`)
  }
  return {
    ...evaluateHardRefrainDump({
      menuDump: entry.xml,
      refrainDump: refrain.xml,
      currentUrl,
    }),
    currentUrl,
  }
}

function runMenuHard(ctx) {
  const scenario = WAVE_TOUCH_SCENARIOS[1]
  const switcher = runHardEntry(ctx, { startPath: '/', openMenu: true, prefix: 'switcher' })
  if (switcher.status !== 'passed') return scenarioResult(scenario, switcher, switcher)
  const more = runHardEntry(ctx, { startPath: '/more', openMenu: false, prefix: 'more' })
  if (more.status !== 'passed') return scenarioResult(scenario, more, more)
  return scenarioResult(
    scenario,
    {
      status: 'passed',
      notes: 'Switcher and More The Refrain opened the difficult-only drill.',
    },
    { currentUrl: more.currentUrl },
  )
}

function runBackSwipe(ctx) {
  const scenario = WAVE_TOUCH_SCENARIOS[2]
  const opened = openDeepLink(ctx, '/practice/stream')
  if (opened) return scenarioResult(scenario, { status: 'unavailable', notes: opened })
  waitForUi(ctx.run, ctx.waitMs)
  const before = dumpUi(ctx, 'swipe-before')
  if (before.error) return scenarioResult(scenario, { status: 'unavailable', notes: before.error })
  const swipe = runCommand(ctx.run, ctx.adb, ctx.serial, [
    'shell',
    'input',
    'swipe',
    '4',
    '800',
    '360',
    '800',
    '250',
  ])
  const swipeError = failedCommand(swipe, 'input swipe')
  if (swipeError) return scenarioResult(scenario, { status: 'unavailable', notes: swipeError })
  waitForUi(ctx.run, ctx.waitMs)
  const after = dumpUi(ctx, 'swipe-after')
  if (after.error) return scenarioResult(scenario, { status: 'unavailable', notes: after.error })
  return scenarioResult(
    scenario,
    evaluatePracticeBackSwipe({ beforeDump: before.xml, afterDump: after.xml }),
  )
}

export function executeWaveScenarios({
  adb = 'adb',
  serial,
  packageName = 'app.loro.android.preview',
  scheme = 'loro',
  outputDir,
  waitMs = 1500,
  run = spawnSync,
} = {}) {
  const probe = probeAndroidDevice({ adb, serial, run })
  if (probe.reason) return unevaluatedWaveScenarios(probe.reason)
  const ctx = {
    adb,
    serial: probe.serial,
    packageName,
    scheme,
    outputDir,
    waitMs,
    run,
  }
  if (outputDir) mkdirSync(outputDir, { recursive: true })
  return [runStreamPhrase(ctx), runMenuHard(ctx), runBackSwipe(ctx)]
}
