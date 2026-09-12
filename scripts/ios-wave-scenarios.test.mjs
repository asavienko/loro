import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  executeIosWaveScenarios,
  parseIosFrame,
  parseIosUiDump,
  probeIosAutomation,
  voiceOverAtRows,
} from './ios-wave-scenarios.mjs'
import { routeUrlFromDump } from './native-wave-scenarios.mjs'
import { PRACTICE_BACK_SWIPES, WAVE_TOUCH_SCENARIOS } from './wave-touch-scenarios.mjs'

const TODAY = JSON.stringify([
  {
    identifier: 'navigation-pull-handle',
    frame: { x: 0, y: 0, width: 360, height: 88 },
    children: [
      {
        label: 'Spanish, open the menu',
        type: 'Button',
        frame: { x: 24, y: 40, width: 336, height: 48 },
      },
      {
        label: 'Start the morning wave',
        type: 'Button',
        frame: { x: 24, y: 400, width: 336, height: 56 },
      },
      { label: 'Today', frame: { x: 24, y: 20, width: 80, height: 24 } },
    ],
  },
])

const STREAM = JSON.stringify([
  {
    label: 'This wave',
    children: [
      {
        label: 'Leave practice',
        type: 'Button',
        frame: { x: 24, y: 40, width: 176, height: 40 },
      },
      { label: 'The Stream', frame: { x: 24, y: 140, width: 200, height: 48 } },
      {
        label: 'Practice this phrase',
        type: 'Button',
        frame: { x: 24, y: 400, width: 336, height: 56 },
      },
      { label: 'loro-route:/practice/stream' },
    ],
  },
])

const STREAM_EXIT = JSON.stringify([
  {
    label: 'This wave',
    children: [
      { label: 'The Stream', frame: { x: 24, y: 140, width: 200, height: 48 } },
      { label: 'Leave this wave?', frame: { x: 24, y: 400, width: 200, height: 48 } },
      {
        label: 'Pause the wave',
        type: 'Button',
        frame: { x: 24, y: 460, width: 336, height: 56 },
      },
      {
        label: 'Keep going',
        type: 'Button',
        frame: { x: 24, y: 520, width: 336, height: 56 },
      },
    ],
  },
])

const PHRASE = JSON.stringify([
  {
    label: 'This phrase',
    children: [
      {
        label: 'Leave practice',
        type: 'Button',
        frame: { x: 24, y: 40, width: 176, height: 40 },
      },
      { label: 'The Refrain', frame: { x: 24, y: 140, width: 200, height: 48 } },
      { identifier: 'loro-route:/practice/refrain?phrase=es-001' },
    ],
  },
])

const PHRASE_EXIT = JSON.stringify([
  {
    label: 'This phrase',
    children: [
      { label: 'The Refrain', frame: { x: 24, y: 140, width: 200, height: 48 } },
      { label: 'Leave this practice?', frame: { x: 24, y: 400, width: 200, height: 48 } },
      {
        label: 'Pause practice',
        type: 'Button',
        frame: { x: 24, y: 460, width: 336, height: 56 },
      },
    ],
  },
])

const MENU = JSON.stringify([
  {
    identifier: 'sheet-pull-handle',
    frame: { x: 24, y: 80, width: 336, height: 60 },
    children: [
      {
        label: 'Dismiss',
        type: 'Button',
        frame: { x: 0, y: 0, width: 360, height: 70 },
      },
      { label: 'Where to?', frame: { x: 24, y: 160, width: 200, height: 40 } },
      {
        label: 'The Refrain',
        type: 'Button',
        frame: { x: 24, y: 300, width: 336, height: 56 },
      },
    ],
  },
])

const HARD = JSON.stringify([
  {
    label: 'Difficult phrases',
    children: [
      { label: 'The Refrain', frame: { x: 24, y: 140, width: 200, height: 48 } },
      { label: 'loro-route:/practice/refrain?filter=hard' },
    ],
  },
])

const MORE = JSON.stringify([
  {
    label: 'The Refrain',
    type: 'Button',
    frame: { x: 24, y: 300, width: 336, height: 56 },
  },
])

const WELCOME = JSON.stringify([
  {
    label: "I'm Loro",
    children: [
      {
        label: "Let's go →",
        type: 'Button',
        frame: { x: 24, y: 400, width: 336, height: 56 },
      },
    ],
  },
])

function expectedPointerAndShell() {
  return [
    ['stream-to-phrase-refrain', 'passed'],
    ['menu-hard-refrain', 'passed'],
    ['practice-back-swipe-disabled', 'passed'],
    ['spine-pull-opens-switcher', 'passed'],
    ['sheet-pull-dismisses-switcher', 'passed'],
    ['sheet-back-dismisses-switcher', 'unavailable'],
    ['sheet-backdrop-dismisses-switcher', 'passed'],
  ]
}

function expectedTalkbackRows(status = 'unavailable') {
  return [
    ['stream-to-phrase-refrain-at', status],
    ['menu-hard-refrain-at', status],
    ['practice-back-swipe-disabled-at', status],
    ['sheet-back-dismisses-switcher-at', status],
    ['sheet-backdrop-dismisses-switcher-at', status],
  ]
}

function atRows(rows) {
  return rows.filter((row) => row.id.endsWith('-at'))
}

function scriptedIosDevice({ moreOpensHard = true, leaveOnFullScreenSwipe = false } = {}) {
  let stage = 'idle'
  const dumpFor = () => {
    if (stage === 'phrase') return PHRASE
    if (stage === 'today') return TODAY
    if (stage === 'menu') return MENU
    if (stage === 'more') return MORE
    if (stage === 'hard') return HARD
    if (stage === 'stream-exit') return STREAM_EXIT
    if (stage === 'exit') return PHRASE_EXIT
    return STREAM
  }
  const applyTap = (tapY) => {
    if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
    else if (stage === 'stream') stage = tapY < 80 ? 'stream-exit' : 'phrase'
    else if (stage === 'stream-exit') stage = 'stream'
    else if (stage === 'phrase') stage = 'exit'
    else if (stage === 'menu') stage = tapY < 80 ? 'today' : 'hard'
    else if (stage === 'more') stage = 'hard'
  }
  return (tool, args) => {
    if (tool === 'idb') {
      if (args.includes('--version')) return { status: 0, stdout: 'idb 1.1.7' }
      if (args[0] === 'connect') return { status: 0, stdout: '' }
      if (args.includes('describe-all')) return { status: 0, stdout: dumpFor() }
      if (args.includes('tap')) {
        applyTap(Number(args[args.indexOf('tap') + 2]))
        return { status: 0, stdout: '' }
      }
      if (args.includes('swipe')) {
        const swipeAt = args.indexOf('swipe')
        const x1 = Number(args[swipeAt + 1])
        const y1 = Number(args[swipeAt + 2])
        const x2 = Number(args[swipeAt + 3])
        const y2 = Number(args[swipeAt + 4])
        const committed = Math.abs(y2 - y1) >= 48 && Math.abs(x2 - x1) < 40
        if (
          leaveOnFullScreenSwipe &&
          x1 === PRACTICE_BACK_SWIPES[1].x1 &&
          x2 === PRACTICE_BACK_SWIPES[1].x2 &&
          stage === 'stream'
        ) {
          stage = 'today'
        } else if (x1 > 20 && committed && stage === 'today') stage = 'menu'
        else if (x1 > 20 && committed && stage === 'menu') stage = 'today'
        return { status: 0, stdout: '' }
      }
      assert.fail(`unexpected idb ${args.join(' ')}`)
    }
    if (tool === 'xcrun') {
      const joined = args.join(' ')
      if (joined.includes('openurl') && joined.includes('practice/stream')) {
        stage = 'stream'
        return { status: 0, stdout: '' }
      }
      if (joined.includes('openurl') && joined.includes('://more')) {
        stage = moreOpensHard ? 'more' : 'today'
        return { status: 0, stdout: '' }
      }
      if (joined.includes('openurl')) {
        stage = 'today'
        return { status: 0, stdout: '' }
      }
      if (joined.includes('log') && args.includes('show')) {
        const url =
          stage === 'phrase'
            ? 'loro-route:/practice/refrain?phrase=es-001'
            : stage === 'hard'
              ? 'loro-route:/practice/refrain?filter=hard'
              : 'loro-route:/practice/stream'
        return { status: 0, stdout: url }
      }
      if (joined.includes('launch')) return { status: 0, stdout: '' }
      assert.fail(`unexpected xcrun ${joined}`)
    }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
}

test('parses AXFrame, nested children, and loro-route identifiers', () => {
  const ax = parseIosUiDump(
    JSON.stringify([
      {
        AXLabel: 'Practice this phrase',
        AXFrame: '{{24, 400}, {336, 56}}',
        AXUniqueId: 'practice',
        children: [{ AXLabel: 'loro-route:/practice/stream' }],
      },
    ]),
  )
  assert.equal(ax.nodes[0].text, 'Practice this phrase')
  assert.deepEqual(ax.nodes[0].bounds, { left: 24, top: 400, right: 360, bottom: 456 })
  assert.equal(routeUrlFromDump(ax), '/practice/stream')

  const identifier = parseIosUiDump(PHRASE)
  assert.equal(routeUrlFromDump(identifier), '/practice/refrain?phrase=es-001')
  assert.deepEqual(parseIosFrame({ x: 10, y: 20, width: 30, height: 40 }), {
    left: 10,
    top: 20,
    right: 40,
    bottom: 60,
  })
  assert.equal(parseIosFrame('not a frame'), null)
})

test('missing idb or UDID never marks a wave row passed', () => {
  const missing = executeIosWaveScenarios({
    udid: 'A123',
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.equal(missing.length, WAVE_TOUCH_SCENARIOS.length)
  assert.ok(missing.every((row) => row.status === 'unavailable'))
  assert.ok(missing.every((row) => row.reason.includes('idb')))

  const noUdid = executeIosWaveScenarios({
    run: () => ({ status: 0, stdout: 'idb 1.1.7' }),
  })
  assert.ok(noUdid.every((row) => row.status === 'unavailable'))
  assert.ok(noUdid.every((row) => row.reason.includes('UDID')))

  const probe = probeIosAutomation({
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.match(probe.reason, /idb is not installed/)
})

test('scripted simulator dumps pass only with matching chrome and route URL', () => {
  const rows = executeIosWaveScenarios({
    udid: 'A123',
    run: scriptedIosDevice(),
    waitMs: 0,
  })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [...expectedPointerAndShell(), ...expectedTalkbackRows('unavailable')],
  )
  assert.equal(rows[0].currentUrl, '/practice/refrain?phrase=es-001')
  assert.equal(rows[1].currentUrl, '/practice/refrain?filter=hard')
  assert.match(
    rows.find((row) => row.id === 'sheet-back-dismisses-switcher').reason,
    /not an iOS control/,
  )
  assert.ok(atRows(rows).every((row) => row.reason.includes('VoiceOver')))
})

test('practice back-swipe probe issues edge then full-screen swipes', () => {
  const backSwipes = []
  const device = scriptedIosDevice()
  const run = (tool, args) => {
    if (tool === 'idb' && args.includes('swipe')) {
      const swipeAt = args.indexOf('swipe')
      const coords = args.slice(swipeAt + 1, swipeAt + 5).map(Number)
      if (coords[1] === 800 && coords[3] === 800) backSwipes.push(coords)
    }
    return device(tool, args)
  }
  const rows = executeIosWaveScenarios({ udid: 'A123', run, waitMs: 0 })
  assert.equal(rows.find((row) => row.id === 'practice-back-swipe-disabled').status, 'passed')
  assert.deepEqual(backSwipes, [
    [4, 800, 360, 800],
    [180, 800, 360, 800],
  ])
})

test('practice back-swipe fails when a full-screen swipe leaves the session', () => {
  const rows = executeIosWaveScenarios({
    udid: 'A123',
    run: scriptedIosDevice({ leaveOnFullScreenSwipe: true }),
    waitMs: 0,
  })
  const row = rows.find((entry) => entry.id === 'practice-back-swipe-disabled')
  assert.equal(row.status, 'failed')
  assert.match(row.notes, /Full-screen swipe left the practice session/)
})

test('VoiceOver looking enabled never marks AT rows passed via ordinary idb taps', () => {
  const enabled = voiceOverAtRows({ enabled: true })
  assert.equal(enabled.length, 5)
  assert.ok(enabled.every((row) => row.status === 'unavailable'))
  assert.ok(enabled.every((row) => row.id.endsWith('-at')))
  assert.ok(enabled.every((row) => row.reason.includes('no VoiceOver driver')))
  assert.ok(enabled.every((row) => !row.reason.includes('TalkBack `-at` rows are Android-only')))

  const rows = executeIosWaveScenarios({
    udid: 'A123',
    run: scriptedIosDevice(),
    waitMs: 0,
    voiceOverEnabled: true,
  })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [...expectedPointerAndShell(), ...expectedTalkbackRows('unavailable')],
  )
  assert.ok(atRows(rows).every((row) => row.reason.includes('no VoiceOver driver')))
  assert.ok(rows.every((row) => row.status !== 'passed' || !row.id.endsWith('-at')))
})

test('menu-hard-refrain fails when More does not open the difficult-only drill', () => {
  const rows = executeIosWaveScenarios({
    udid: 'A123',
    run: scriptedIosDevice({ moreOpensHard: false }),
    waitMs: 0,
  })
  assert.equal(rows[0].status, 'passed')
  assert.equal(rows[1].status, 'failed')
  assert.match(rows[1].notes, /The Refrain/)
})

test('dump without a route URL cannot pass Stream → phrase Refrain', () => {
  const run = (tool, args) => {
    if (tool === 'idb' && args.includes('--version')) return { status: 0, stdout: 'idb' }
    if (tool === 'idb' && args[0] === 'connect') return { status: 0, stdout: '' }
    if (tool === 'xcrun' && args.includes('openurl')) return { status: 0, stdout: '' }
    if (tool === 'idb' && args.includes('describe-all')) {
      return {
        status: 0,
        stdout: JSON.stringify([
          {
            label: 'Start the morning wave',
            type: 'Button',
            frame: { x: 24, y: 400, width: 336, height: 56 },
          },
        ]),
      }
    }
    if (tool === 'idb' && args.includes('tap')) return { status: 0, stdout: '' }
    if (tool === 'idb' && args.includes('swipe')) return { status: 0, stdout: '' }
    if (tool === 'xcrun' && args.includes('show')) return { status: 0, stdout: '' }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
  const rows = executeIosWaveScenarios({ udid: 'A123', run, waitMs: 0 })
  assert.equal(rows[0].status, 'unavailable')
  assert.match(rows[0].notes, /cannot prove/)
})

test('onboarding that never reaches Today keeps every row unavailable', () => {
  const run = (tool, args) => {
    if (tool === 'idb' && args.includes('--version')) return { status: 0, stdout: 'idb' }
    if (tool === 'idb' && args[0] === 'connect') return { status: 0, stdout: '' }
    if (tool === 'xcrun' && args.includes('openurl')) return { status: 0, stdout: '' }
    if (tool === 'idb' && args.includes('describe-all')) return { status: 0, stdout: WELCOME }
    if (tool === 'idb' && args.includes('tap')) return { status: 0, stdout: '' }
    assert.fail(`unexpected ${tool} ${args.join(' ')}`)
  }
  const rows = executeIosWaveScenarios({ udid: 'A123', run, waitMs: 0 })
  assert.ok(rows.every((row) => row.status === 'unavailable'))
  assert.ok(rows.every((row) => row.reason.includes('Onboarding')))
})
