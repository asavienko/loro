/**
 * Drive plan 101/93 wave-path rows on an iOS simulator through simctl + idb.
 *
 * A screenshot of whatever is on screen is not a pass. Missing Xcode, idb, or a
 * booted simulator stays unavailable. Dump-only evaluation never marks a row
 * passed. TalkBack `-at` rows stay unavailable here — VoiceOver physical-device
 * remains plan 58/93.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  dumpHas,
  dumpHasSwitcher,
  evaluateHardRefrainDump,
  evaluateOnboardedHome,
  evaluatePracticeBackSwipe,
  evaluateRefrainExitBack,
  evaluateStreamExitBack,
  evaluateSheetBackdropDismiss,
  evaluateSheetDismiss,
  evaluateSpinePull,
  evaluatePhraseDetailPracticeDump,
  evaluateStreamPhraseDump,
  evaluateTodayStreamDump,
  phraseIdFromUrl,
  findClickableLabel,
  findLabel,
  findResourceId,
  findWaveStart,
  isOnboardingDump,
  isTodayHomeDump,
  routeUrlFromDump,
  routeUrlFromLogcat,
  tapBounds,
  tapDismissBounds,
} from './native-wave-scenarios.mjs'
import {
  idbPracticeBackSwipeArgs,
  PRACTICE_BACK_SWIPES,
  unevaluatedWaveScenarios,
  waveScenario,
} from './wave-touch-scenarios.mjs'

const STREAM_PRACTICE = 'Practice this phrase'
const LEAVE_PRACTICE = 'Leave practice'
const KEEP_GOING = 'Keep going'
const PAUSE_WAVE = 'Pause the wave'
const LEAVE_THIS_WAVE = 'Leave this wave?'
const REFRAIN_TITLE = 'The Refrain'
const MENU_OPEN = 'open the menu'
const SPINE_HANDLE = 'navigation-pull-handle'
const SHEET_HANDLE = 'sheet-pull-handle'
const PULL_COMMIT_DY = 200
const PULL_COMMIT_MS = 800
const PULL_SHORT_DY = 20
const PULL_HORIZONTAL_DX = 80
const STREAM_RAIL = 'Stream'
const ONBOARD_WELCOME = "Let's go →"
const ONBOARD_CONTINUE = 'Continue'
const ONBOARD_READY = 'Start learning'
const ONBOARD_STEPS = [
  ONBOARD_WELCOME,
  'Just curious',
  'Starting out',
  '10 minutes',
  'Café & ordering',
  'Getting around',
  ONBOARD_CONTINUE,
  ONBOARD_READY,
]
const AT_REASON =
  'TalkBack `-at` rows are Android-only. VoiceOver physical-device remains plan 58/93.'
const ANDROID_BACK_REASON =
  'Android Back / Modal onRequestClose is not an iOS control. Backdrop and pull-down remain the iOS dismiss rows.'

export function voiceOverAtReason({ enabled = false } = {}) {
  if (enabled) {
    return 'VoiceOver appears enabled, but this runner has no VoiceOver driver. Ordinary idb taps are not AT proof. VoiceOver physical-device remains plan 58/93.'
  }
  return AT_REASON
}

export function voiceOverAtRows(options) {
  return unevaluatedWaveScenarios(voiceOverAtReason(options)).filter((row) =>
    row.id.endsWith('-at'),
  )
}

export function parseIosFrame(frame) {
  if (!frame) return null
  if (typeof frame === 'string') {
    const match =
      /\{\s*\{\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\}\s*,\s*\{\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\}\s*\}/.exec(
        frame,
      )
    if (!match) return null
    const left = Number(match[1])
    const top = Number(match[2])
    const width = Number(match[3])
    const height = Number(match[4])
    return { left, top, right: left + width, bottom: top + height }
  }
  if (typeof frame !== 'object') return null
  const left = Number(frame.x ?? frame.origin?.x ?? frame.left)
  const top = Number(frame.y ?? frame.origin?.y ?? frame.top)
  const width = Number(frame.width ?? frame.size?.width ?? frame.w)
  const height = Number(frame.height ?? frame.size?.height ?? frame.h)
  if (![left, top, width, height].every(Number.isFinite)) return null
  return { left, top, right: left + width, bottom: top + height }
}

function asNodeList(value) {
  if (Array.isArray(value)) return value.flatMap(asNodeList)
  if (value && typeof value === 'object') return [value]
  return []
}

function nodeText(node) {
  return String(node.AXLabel ?? node.label ?? node.name ?? node.text ?? node.title ?? '')
}

function nodeValue(node) {
  return String(node.AXValue ?? node.value ?? node.contentDesc ?? '')
}

function nodeIdentifier(node) {
  return String(
    node.AXUniqueId ?? node.identifier ?? node.uniqueId ?? node.testID ?? node.resourceId ?? '',
  )
}

function flattenIosNode(node, acc) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const text = nodeText(node)
  const contentDesc = nodeValue(node)
  const resourceId = nodeIdentifier(node)
  const route = [text, contentDesc, resourceId].find((label) => label.startsWith('loro-route:'))
  acc.push({
    text: route ?? text,
    contentDesc,
    resourceId: route && resourceId.startsWith('loro-route:') ? resourceId : resourceId,
    clickable: node.enabled !== false,
    enabled: node.enabled !== false,
    bounds: parseIosFrame(node.AXFrame ?? node.frame ?? node.rect ?? node.bounds),
  })
  for (const child of asNodeList(node.children ?? node.child ?? node.subviews)) {
    flattenIosNode(child, acc)
  }
}

export function parseIosUiDump(payload) {
  if (payload && typeof payload === 'object' && Array.isArray(payload.nodes)) {
    return payload
  }
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? [])
  let parsed
  try {
    parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  } catch {
    return { nodes: [], raw }
  }
  const nodes = []
  for (const root of asNodeList(parsed)) flattenIosNode(root, nodes)
  return { nodes, raw }
}

function failedCommand(result, label) {
  if (result.error) return `${label} unavailable: ${result.error.code || result.error.message}`
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n')[0]
    return `${label} failed: ${detail}`
  }
  return null
}

export function probeIosAutomation({ run = spawnSync } = {}) {
  const version = run('idb', ['--version'], { encoding: 'utf8' })
  const missing = failedCommand(version, 'idb')
  if (missing) {
    return {
      reason:
        'idb is not installed on this host. iOS wave-path rows stay unavailable; Android adb/uiautomator and browser Playwright are not iOS evidence.',
    }
  }
  return { ok: true }
}

function waitForUi(_run, ms) {
  if (ms <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runTool(ctx, tool, args) {
  return ctx.run(tool, args, { encoding: 'utf8' })
}

function idb(ctx, args) {
  return runTool(ctx, 'idb', [...args, '--udid', ctx.udid])
}

function dumpUi(ctx, name) {
  const describe = idb(ctx, ['ui', 'describe-all', '--json', '--nested'])
  const describeError = failedCommand(describe, 'idb ui describe-all')
  if (describeError) return { error: describeError }
  const raw = describe.stdout || '[]'
  const parsed = parseIosUiDump(raw)
  if (ctx.outputDir) {
    mkdirSync(ctx.outputDir, { recursive: true })
    writeFileSync(resolve(ctx.outputDir, `${name}.json`), raw)
  }
  return { dump: parsed }
}

function tapPoint(ctx, x, y, label) {
  const tap = idb(ctx, ['ui', 'tap', String(x), String(y)])
  return failedCommand(tap, `idb ui tap ${label}`)
}

function tapLabel(ctx, dump, label) {
  const point = tapBounds(dump, label)
  if (!point) return `Missing tap target: ${label}`
  return tapPoint(ctx, point.x, point.y, label)
}

function tapDismissBackdrop(ctx, dump) {
  const point = tapDismissBounds(dump)
  if (!point) return 'Missing tap target: Dismiss'
  return tapPoint(ctx, point.x, point.y, 'Dismiss')
}

function tapWaveStart(ctx, dump) {
  const node = findWaveStart(dump)
  if (!node?.bounds) return 'Missing tap target: Start the * wave'
  const { left, top, right, bottom } = node.bounds
  return tapPoint(ctx, Math.floor((left + right) / 2), Math.floor((top + bottom) / 2), 'wave start')
}

function openDeepLink(ctx, path) {
  const uri = path === '/' ? `${ctx.scheme}://` : `${ctx.scheme}://${path.replace(/^\//, '')}`
  const opened = runTool(ctx, 'xcrun', ['simctl', 'openurl', ctx.udid, uri])
  return failedCommand(opened, `simctl openurl ${uri}`)
}

function openStreamFromToday(ctx, dump) {
  if (findWaveStart(dump)) return tapWaveStart(ctx, dump)
  const rail = findClickableLabel(dump, STREAM_RAIL) ?? findLabel(dump, STREAM_RAIL)
  if (rail?.bounds) {
    const { left, top, right, bottom } = rail.bounds
    return tapPoint(
      ctx,
      Math.floor((left + right) / 2),
      Math.floor((top + bottom) / 2),
      'Stream rail',
    )
  }
  return openDeepLink(ctx, '/practice/stream')
}

function swipeNode(ctx, node, { dx = 0, dy = 0, ms = 250 } = {}) {
  if (!node?.bounds) return 'Missing swipe target'
  const { left, top, right, bottom } = node.bounds
  const x = Math.floor((left + right) / 2)
  const y = Math.floor(top + (bottom - top) * 0.4)
  const swipe = idb(ctx, [
    'ui',
    'swipe',
    String(x),
    String(y),
    String(x + dx),
    String(y + dy),
    '--duration',
    String(ms / 1000),
  ])
  return failedCommand(swipe, 'idb ui swipe')
}

function currentActivityUrl(ctx, dump) {
  const fromDump = dump ? routeUrlFromDump(dump) : ''
  if (fromDump) return fromDump
  const log = runTool(ctx, 'xcrun', [
    'simctl',
    'spawn',
    ctx.udid,
    'log',
    'show',
    '--last',
    '1m',
    '--style',
    'compact',
    '--predicate',
    'eventMessage CONTAINS "loro-route:"',
  ])
  if (failedCommand(log, 'simctl log show')) return ''
  return routeUrlFromLogcat(log.stdout)
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

function findOnboardControl(dump, already) {
  for (const name of ONBOARD_STEPS) {
    if (already.has(name)) continue
    const node = findLabel(dump, name)
    if (!node) continue
    if (name === ONBOARD_CONTINUE && node.enabled === false) continue
    return name
  }
  return null
}

function completeOnboarding(ctx) {
  const already = new Set()
  for (let step = 0; step < 16; step += 1) {
    const dump = dumpUi(ctx, `onboard-${step}`)
    if (dump.error) return { status: 'unavailable', notes: dump.error }
    const home = evaluateOnboardedHome(dump.dump)
    if (home.status === 'passed') return home
    if (!isOnboardingDump(dump.dump)) {
      return { status: 'unavailable', notes: 'Left onboarding without reaching Today.' }
    }
    const label = findOnboardControl(dump.dump, already)
    if (!label) {
      return { status: 'failed', notes: 'Onboarding dump has no next first-run control.' }
    }
    if (label !== ONBOARD_CONTINUE) already.add(label)
    const tapped = tapLabel(ctx, dump.dump, label)
    if (tapped) return { status: 'failed', notes: tapped }
    waitForUi(ctx.run, ctx.waitMs)
  }
  return { status: 'failed', notes: 'Onboarding did not reach Today within the step budget.' }
}

export function ensureIosLearnerHome(ctx) {
  const opened = openDeepLink(ctx, '/')
  if (opened) return { status: 'unavailable', notes: opened }
  waitForUi(ctx.run, ctx.waitMs)
  const dump = dumpUi(ctx, 'home-entry')
  if (dump.error) return { status: 'unavailable', notes: dump.error }
  if (findWaveStart(dump.dump)) return evaluateOnboardedHome(dump.dump)
  if (isOnboardingDump(dump.dump)) return completeOnboarding(ctx)
  if (!isTodayHomeDump(dump.dump)) {
    const launched = runTool(ctx, 'xcrun', ['simctl', 'launch', ctx.udid, ctx.packageName])
    if (failedCommand(launched, 'simctl launch')) {
      return evaluateOnboardedHome(dump.dump)
    }
    waitForUi(ctx.run, ctx.waitMs)
    const again = dumpUi(ctx, 'home-launch')
    if (again.error) return { status: 'unavailable', notes: again.error }
    if (isOnboardingDump(again.dump)) return completeOnboarding(ctx)
    return evaluateOnboardedHome(again.dump)
  }
  return evaluateOnboardedHome(dump.dump)
}

function runStreamPhrase(ctx) {
  const scenario = waveScenario('stream-to-phrase-refrain')
  const opened = openDeepLink(ctx, '/')
  if (opened) return scenarioResult(scenario, { status: 'unavailable', notes: opened })
  waitForUi(ctx.run, ctx.waitMs)
  const today = dumpUi(ctx, 'today-before')
  if (today.error) return scenarioResult(scenario, { status: 'unavailable', notes: today.error })
  const started = openStreamFromToday(ctx, today.dump)
  if (started) return scenarioResult(scenario, { status: 'failed', notes: started })
  waitForUi(ctx.run, ctx.waitMs)
  const stream = dumpUi(ctx, 'stream-before')
  if (stream.error) return scenarioResult(scenario, { status: 'unavailable', notes: stream.error })
  const streamUrl = currentActivityUrl(ctx, stream.dump)
  const todayEval = evaluateTodayStreamDump({
    todayDump: today.dump,
    streamDump: stream.dump,
    currentUrl: streamUrl,
  })
  if (todayEval.status !== 'passed')
    return scenarioResult(scenario, todayEval, { currentUrl: streamUrl })
  const tapped = tapLabel(ctx, stream.dump, STREAM_PRACTICE)
  if (tapped) return scenarioResult(scenario, { status: 'failed', notes: tapped })
  waitForUi(ctx.run, ctx.waitMs)
  const refrain = dumpUi(ctx, 'stream-after')
  if (refrain.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: refrain.error })
  const currentUrl = currentActivityUrl(ctx, refrain.dump)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, 'stream-url.txt'), `${currentUrl}\n`)
  }
  const streamEval = evaluateStreamPhraseDump({
    streamDump: stream.dump,
    refrainDump: refrain.dump,
    currentUrl,
  })
  if (streamEval.status !== 'passed') return scenarioResult(scenario, streamEval, { currentUrl })
  const phraseId = phraseIdFromUrl(currentUrl)
  if (!phraseId) {
    return scenarioResult(
      scenario,
      {
        status: 'failed',
        notes: 'Stream phrase URL does not expose a phrase id for Practice now.',
      },
      { currentUrl },
    )
  }
  const openedDetail = openDeepLink(ctx, `/phrase/${phraseId}`)
  if (openedDetail) return scenarioResult(scenario, { status: 'unavailable', notes: openedDetail })
  waitForUi(ctx.run, ctx.waitMs)
  const detail = dumpUi(ctx, 'phrase-detail-before')
  if (detail.error) return scenarioResult(scenario, { status: 'unavailable', notes: detail.error })
  const tappedNow = tapLabel(ctx, detail.dump, 'Practice now')
  if (tappedNow) return scenarioResult(scenario, { status: 'failed', notes: tappedNow })
  waitForUi(ctx.run, ctx.waitMs)
  const fromDetail = dumpUi(ctx, 'phrase-detail-after')
  if (fromDetail.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: fromDetail.error })
  const detailUrl = currentActivityUrl(ctx, fromDetail.dump)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, 'phrase-detail-url.txt'), `${detailUrl}\n`)
  }
  const detailEval = evaluatePhraseDetailPracticeDump({
    detailDump: detail.dump,
    refrainDump: fromDetail.dump,
    currentUrl: detailUrl,
    phraseId,
  })
  if (detailEval.status !== 'passed')
    return scenarioResult(scenario, detailEval, { currentUrl: detailUrl })
  return scenarioResult(
    scenario,
    {
      status: 'passed',
      notes: 'Stream Practice this phrase and phrase-detail Practice now opened phrase focus.',
    },
    { currentUrl: detailUrl },
  )
}

function runHardEntry(ctx, { startPath, openMenu, prefix }) {
  const opened = openDeepLink(ctx, startPath)
  if (opened) return { status: 'unavailable', notes: opened }
  waitForUi(ctx.run, ctx.waitMs)
  let entry = dumpUi(ctx, `${prefix}-start`)
  if (entry.error) return { status: 'unavailable', notes: entry.error }
  if (openMenu) {
    const openedMenu = tapLabel(ctx, entry.dump, MENU_OPEN)
    if (openedMenu) return { status: 'failed', notes: openedMenu }
    waitForUi(ctx.run, ctx.waitMs)
    entry = dumpUi(ctx, `${prefix}-menu`)
    if (entry.error) return { status: 'unavailable', notes: entry.error }
    if (!dumpHasSwitcher(entry.dump)) {
      return { status: 'failed', notes: 'Menu control did not open the switcher.' }
    }
  }
  const tapped = tapLabel(ctx, entry.dump, REFRAIN_TITLE)
  if (tapped) return { status: 'failed', notes: tapped }
  waitForUi(ctx.run, ctx.waitMs)
  const refrain = dumpUi(ctx, `${prefix}-after`)
  if (refrain.error) return { status: 'unavailable', notes: refrain.error }
  const currentUrl = currentActivityUrl(ctx, refrain.dump)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, `${prefix}-url.txt`), `${currentUrl}\n`)
  }
  return {
    ...evaluateHardRefrainDump({
      menuDump: entry.dump,
      refrainDump: refrain.dump,
      currentUrl,
    }),
    currentUrl,
  }
}

function runHardFromPhraseFocus(ctx) {
  const opened = openDeepLink(ctx, '/practice/stream')
  if (opened) return { status: 'unavailable', notes: opened }
  waitForUi(ctx.run, ctx.waitMs)
  const stream = dumpUi(ctx, 'phrase-focus-stream')
  if (stream.error) return { status: 'unavailable', notes: stream.error }
  const openedPhrase = tapLabel(ctx, stream.dump, STREAM_PRACTICE)
  if (openedPhrase) return { status: 'failed', notes: openedPhrase }
  waitForUi(ctx.run, ctx.waitMs)
  const phrase = dumpUi(ctx, 'phrase-focus-session')
  if (phrase.error) return { status: 'unavailable', notes: phrase.error }
  if (!dumpHas(phrase.dump, 'This phrase') || !dumpHas(phrase.dump, REFRAIN_TITLE)) {
    return { status: 'failed', notes: 'Stream Practice this phrase did not open phrase focus.' }
  }
  const openedMenu = tapLabel(ctx, phrase.dump, MENU_OPEN)
  if (openedMenu) return { status: 'failed', notes: openedMenu }
  waitForUi(ctx.run, ctx.waitMs)
  const menu = dumpUi(ctx, 'phrase-focus-menu')
  if (menu.error) return { status: 'unavailable', notes: menu.error }
  if (!dumpHasSwitcher(menu.dump)) {
    return { status: 'failed', notes: 'Phrase-focus menu control did not open the switcher.' }
  }
  const tapped = tapLabel(ctx, menu.dump, REFRAIN_TITLE)
  if (tapped) return { status: 'failed', notes: tapped }
  waitForUi(ctx.run, ctx.waitMs)
  const refrain = dumpUi(ctx, 'phrase-focus-hard')
  if (refrain.error) return { status: 'unavailable', notes: refrain.error }
  const currentUrl = currentActivityUrl(ctx, refrain.dump)
  if (ctx.outputDir) {
    writeFileSync(resolve(ctx.outputDir, 'phrase-focus-hard-url.txt'), `${currentUrl}\n`)
  }
  return {
    ...evaluateHardRefrainDump({
      menuDump: menu.dump,
      refrainDump: refrain.dump,
      currentUrl,
    }),
    currentUrl,
  }
}

function runMenuHard(ctx) {
  const scenario = waveScenario('menu-hard-refrain')
  const switcher = runHardEntry(ctx, { startPath: '/', openMenu: true, prefix: 'switcher' })
  if (switcher.status !== 'passed') return scenarioResult(scenario, switcher, switcher)
  const more = runHardEntry(ctx, { startPath: '/more', openMenu: false, prefix: 'more' })
  if (more.status !== 'passed') return scenarioResult(scenario, more, more)
  const fromPhrase = runHardFromPhraseFocus(ctx)
  if (fromPhrase.status !== 'passed') return scenarioResult(scenario, fromPhrase, fromPhrase)
  return scenarioResult(
    scenario,
    {
      status: 'passed',
      notes:
        'Switcher, More, and phrase-focus switcher The Refrain opened the difficult-only drill.',
    },
    { currentUrl: fromPhrase.currentUrl },
  )
}

function runBackSwipe(ctx) {
  const scenario = waveScenario('practice-back-swipe-disabled')
  const opened = openDeepLink(ctx, '/practice/stream')
  if (opened) return scenarioResult(scenario, { status: 'unavailable', notes: opened })
  waitForUi(ctx.run, ctx.waitMs)
  const before = dumpUi(ctx, 'swipe-before')
  if (before.error) return scenarioResult(scenario, { status: 'unavailable', notes: before.error })
  let after = before
  for (const swipe of PRACTICE_BACK_SWIPES) {
    const command = idb(ctx, idbPracticeBackSwipeArgs(swipe))
    const swipeError = failedCommand(command, 'idb ui swipe')
    if (swipeError) return scenarioResult(scenario, { status: 'unavailable', notes: swipeError })
    waitForUi(ctx.run, ctx.waitMs)
    after = dumpUi(ctx, `swipe-after-${swipe.id}`)
    if (after.error) return scenarioResult(scenario, { status: 'unavailable', notes: after.error })
    const result = evaluatePracticeBackSwipe({
      beforeDump: before.dump,
      afterDump: after.dump,
      swipeId: swipe.id,
    })
    if (result.status !== 'passed') return scenarioResult(scenario, result)
  }
  let waveSheet = after
  if (!dumpHas(after.dump, PAUSE_WAVE) && !dumpHas(after.dump, LEAVE_THIS_WAVE)) {
    const openedWave = tapLabel(ctx, after.dump, LEAVE_PRACTICE)
    if (openedWave) return scenarioResult(scenario, { status: 'failed', notes: openedWave })
    waitForUi(ctx.run, ctx.waitMs)
    waveSheet = dumpUi(ctx, 'stream-after-leave')
    if (waveSheet.error)
      return scenarioResult(scenario, { status: 'unavailable', notes: waveSheet.error })
  }
  const waveExit = evaluateStreamExitBack({
    beforeDump: before.dump,
    afterDump: waveSheet.dump,
  })
  if (waveExit.status !== 'passed') return scenarioResult(scenario, waveExit)
  const dismissedWave = tapLabel(ctx, waveSheet.dump, KEEP_GOING)
  if (dismissedWave) return scenarioResult(scenario, { status: 'failed', notes: dismissedWave })
  waitForUi(ctx.run, ctx.waitMs)
  const afterKeepGoing = dumpUi(ctx, 'stream-after-keep-going')
  if (afterKeepGoing.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: afterKeepGoing.error })
  const openedPhrase = tapLabel(ctx, afterKeepGoing.dump, STREAM_PRACTICE)
  if (openedPhrase) return scenarioResult(scenario, { status: 'failed', notes: openedPhrase })
  waitForUi(ctx.run, ctx.waitMs)
  const phrase = dumpUi(ctx, 'refrain-before-leave')
  if (phrase.error) return scenarioResult(scenario, { status: 'unavailable', notes: phrase.error })
  const openedPractice = tapLabel(ctx, phrase.dump, LEAVE_PRACTICE)
  if (openedPractice) return scenarioResult(scenario, { status: 'failed', notes: openedPractice })
  waitForUi(ctx.run, ctx.waitMs)
  const exit = dumpUi(ctx, 'refrain-after-leave')
  if (exit.error) return scenarioResult(scenario, { status: 'unavailable', notes: exit.error })
  const openedExit = evaluateRefrainExitBack({
    beforeDump: phrase.dump,
    afterDump: exit.dump,
  })
  if (openedExit.status !== 'passed') return scenarioResult(scenario, openedExit)
  return scenarioResult(scenario, {
    status: 'passed',
    notes:
      'Edge and full-screen swipes stayed on the session; the wave sheet then the phrase-drill sheet opened on session exit.',
  })
}

function runSpinePull(ctx) {
  const scenario = waveScenario('spine-pull-opens-switcher')
  const opened = openDeepLink(ctx, '/')
  if (opened) return scenarioResult(scenario, { status: 'unavailable', notes: opened })
  waitForUi(ctx.run, ctx.waitMs)
  const before = dumpUi(ctx, 'spine-before')
  if (before.error) return scenarioResult(scenario, { status: 'unavailable', notes: before.error })
  const handle = findResourceId(before.dump, SPINE_HANDLE)
  if (!handle) {
    return scenarioResult(scenario, {
      status: 'unavailable',
      notes: 'Today dump does not expose the spine pull handle.',
    })
  }
  const short = swipeNode(ctx, handle, { dy: PULL_SHORT_DY })
  if (short) return scenarioResult(scenario, { status: 'unavailable', notes: short })
  waitForUi(ctx.run, ctx.waitMs)
  const afterShort = dumpUi(ctx, 'spine-short')
  if (afterShort.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: afterShort.error })
  const sideways = swipeNode(ctx, handle, { dx: PULL_HORIZONTAL_DX })
  if (sideways) return scenarioResult(scenario, { status: 'unavailable', notes: sideways })
  waitForUi(ctx.run, ctx.waitMs)
  const afterSide = dumpUi(ctx, 'spine-horizontal')
  if (afterSide.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: afterSide.error })
  const inertDump = dumpHasSwitcher(afterShort.dump) ? afterShort.dump : afterSide.dump
  let after = { dump: before.dump }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const commitError = swipeNode(ctx, handle, { dy: PULL_COMMIT_DY, ms: PULL_COMMIT_MS })
    if (commitError) return scenarioResult(scenario, { status: 'unavailable', notes: commitError })
    waitForUi(ctx.run, ctx.waitMs)
    after = dumpUi(ctx, attempt === 2 ? 'spine-after' : `spine-commit-${attempt}`)
    if (after.error) return scenarioResult(scenario, { status: 'unavailable', notes: after.error })
    if (dumpHasSwitcher(after.dump)) break
  }
  return scenarioResult(
    scenario,
    evaluateSpinePull({
      beforeDump: before.dump,
      afterDump: after.dump,
      inertDump,
    }),
  )
}

function openSwitcher(ctx, prefix) {
  const opened = openDeepLink(ctx, '/')
  if (opened) return { status: 'unavailable', notes: opened }
  waitForUi(ctx.run, ctx.waitMs)
  let entry = dumpUi(ctx, `${prefix}-start`)
  if (entry.error) return { status: 'unavailable', notes: entry.error }
  if (!dumpHasSwitcher(entry.dump)) {
    const handle = findResourceId(entry.dump, SPINE_HANDLE)
    const pulled = handle
      ? swipeNode(ctx, handle, { dy: PULL_COMMIT_DY, ms: PULL_COMMIT_MS })
      : tapLabel(ctx, entry.dump, MENU_OPEN)
    if (pulled) return { status: 'failed', notes: pulled }
    waitForUi(ctx.run, ctx.waitMs)
    entry = dumpUi(ctx, `${prefix}-menu`)
    if (entry.error) return { status: 'unavailable', notes: entry.error }
    if (!dumpHasSwitcher(entry.dump)) {
      const openedMenu = tapLabel(ctx, entry.dump, MENU_OPEN)
      if (openedMenu) return { status: 'failed', notes: openedMenu }
      waitForUi(ctx.run, ctx.waitMs)
      entry = dumpUi(ctx, `${prefix}-menu`)
      if (entry.error) return { status: 'unavailable', notes: entry.error }
    }
  }
  if (!dumpHasSwitcher(entry.dump)) {
    return { status: 'failed', notes: 'Menu control did not open the switcher.' }
  }
  return { dump: entry.dump }
}

function runSheetDismiss(ctx) {
  const scenario = waveScenario('sheet-pull-dismisses-switcher')
  const opened = openSwitcher(ctx, 'sheet')
  if (opened.status) return scenarioResult(scenario, opened)
  const sheet = findResourceId(opened.dump, SHEET_HANDLE)
  if (!sheet) {
    return scenarioResult(scenario, {
      status: 'unavailable',
      notes: 'Switcher dump does not expose the sheet pull handle.',
    })
  }
  const short = swipeNode(ctx, sheet, { dy: PULL_SHORT_DY })
  if (short) return scenarioResult(scenario, { status: 'unavailable', notes: short })
  waitForUi(ctx.run, ctx.waitMs)
  const afterShort = dumpUi(ctx, 'sheet-short')
  if (afterShort.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: afterShort.error })
  const sideways = swipeNode(ctx, sheet, { dx: PULL_HORIZONTAL_DX })
  if (sideways) return scenarioResult(scenario, { status: 'unavailable', notes: sideways })
  waitForUi(ctx.run, ctx.waitMs)
  const afterSide = dumpUi(ctx, 'sheet-horizontal')
  if (afterSide.error)
    return scenarioResult(scenario, { status: 'unavailable', notes: afterSide.error })
  const inertDump = !dumpHasSwitcher(afterShort.dump) ? afterShort.dump : afterSide.dump
  const commit = swipeNode(ctx, sheet, { dy: PULL_COMMIT_DY, ms: PULL_COMMIT_MS })
  if (commit) return scenarioResult(scenario, { status: 'unavailable', notes: commit })
  waitForUi(ctx.run, ctx.waitMs)
  const after = dumpUi(ctx, 'sheet-after')
  if (after.error) return scenarioResult(scenario, { status: 'unavailable', notes: after.error })
  return scenarioResult(
    scenario,
    evaluateSheetDismiss({
      menuDump: opened.dump,
      afterDump: after.dump,
      inertDump,
    }),
  )
}

function runSheetBackDismiss() {
  return scenarioResult(waveScenario('sheet-back-dismisses-switcher'), {
    status: 'unavailable',
    notes: ANDROID_BACK_REASON,
  })
}

function runSheetBackdropDismiss(ctx) {
  const scenario = waveScenario('sheet-backdrop-dismisses-switcher')
  const opened = openSwitcher(ctx, 'backdrop')
  if (opened.status) return scenarioResult(scenario, opened)
  const tapped = tapDismissBackdrop(ctx, opened.dump)
  if (tapped) return scenarioResult(scenario, { status: 'failed', notes: tapped })
  waitForUi(ctx.run, ctx.waitMs)
  const after = dumpUi(ctx, 'backdrop-after')
  if (after.error) return scenarioResult(scenario, { status: 'unavailable', notes: after.error })
  return scenarioResult(
    scenario,
    evaluateSheetBackdropDismiss({ menuDump: opened.dump, afterDump: after.dump }),
  )
}

function connectCompanion(ctx) {
  const connected = runTool(ctx, 'idb', ['connect', ctx.udid])
  return failedCommand(connected, 'idb connect')
}

export function executeIosWaveScenarios({
  udid,
  packageName = 'app.loro.ios',
  scheme = 'loro',
  outputDir,
  waitMs = 1500,
  voiceOverEnabled = false,
  run = spawnSync,
} = {}) {
  const probe = probeIosAutomation({ run })
  if (probe.reason) return unevaluatedWaveScenarios(probe.reason)
  if (!udid) {
    return unevaluatedWaveScenarios(
      'No booted iOS simulator UDID. iOS wave-path rows stay unavailable until simctl + idb drive them.',
    )
  }
  const ctx = { udid, packageName, scheme, outputDir, waitMs, run }
  if (outputDir) mkdirSync(outputDir, { recursive: true })
  const companion = connectCompanion(ctx)
  const home = ensureIosLearnerHome(ctx)
  if (home.status !== 'passed') {
    return unevaluatedWaveScenarios(home.notes ?? companion ?? home.reason)
  }
  return [
    runStreamPhrase(ctx),
    runMenuHard(ctx),
    runBackSwipe(ctx),
    runSpinePull(ctx),
    runSheetDismiss(ctx),
    runSheetBackDismiss(),
    runSheetBackdropDismiss(ctx),
    ...voiceOverAtRows({ enabled: voiceOverEnabled }),
  ]
}
