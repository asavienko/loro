import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WAVE_SCENARIO_IDS,
  evaluateHardRefrainDump,
  evaluatePracticeBackSwipe,
  evaluatePracticeGestureDisabledDump,
  evaluateStreamPhraseDump,
  executeWaveScenarios,
  parseUiDump,
  probeAndroidDevice,
  tapBounds,
} from './native-wave-scenarios.mjs'

const STREAM_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="This wave" bounds="[24,200][360,248]"/>
    <node class="android.widget.Button" content-desc="Practice this phrase" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const PHRASE_REFRAIN_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="This phrase" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const MENU_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" content-desc="The Refrain" clickable="true" bounds="[24,300][360,356]"/>
  </node>
</hierarchy>`

const HARD_REFRAIN_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="Difficult phrases" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const HARD_EMPTY_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="No difficult phrases yet" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const PRACTICE_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="This wave" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Stream" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const TODAY_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" text="Start the morning wave" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const HOME_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" content-desc="Spanish, open the menu" clickable="true" bounds="[24,40][360,88]"/>
    <node class="android.widget.Button" text="Start the morning wave" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

test('lists the three 101/93 rows', () => {
  assert.deepEqual(WAVE_SCENARIO_IDS, [
    'stream-to-phrase-refrain',
    'menu-hard-refrain',
    'practice-back-swipe-disabled',
  ])
})

test('parses bounds and taps the control centre', () => {
  const dump = parseUiDump(STREAM_DUMP)
  const tap = tapBounds(dump, 'Practice this phrase')
  assert.deepEqual(tap, { x: 192, y: 428 })
})

test('passes Stream → phrase Refrain when chrome and URL match', () => {
  const result = evaluateStreamPhraseDump({
    streamDump: STREAM_DUMP,
    refrainDump: PHRASE_REFRAIN_DUMP,
    currentUrl: 'loro://practice/refrain?phrase=es-001',
  })
  assert.equal(result.status, 'passed')
  assert.match(result.notes, /phrase focus/)
})

test('fails Stream → phrase Refrain when the URL stays on Stream', () => {
  const result = evaluateStreamPhraseDump({
    streamDump: STREAM_DUMP,
    refrainDump: STREAM_DUMP,
    currentUrl: 'loro://practice/stream',
  })
  assert.equal(result.status, 'failed')
})

test('never treats a dump-only path as a device pass', () => {
  const result = evaluateStreamPhraseDump({
    streamDump: STREAM_DUMP,
    refrainDump: PHRASE_REFRAIN_DUMP,
    currentUrl: '',
  })
  assert.equal(result.status, 'unavailable')
})

test('passes menu hard-filter when chrome and URL match', () => {
  const result = evaluateHardRefrainDump({
    menuDump: MENU_DUMP,
    refrainDump: HARD_REFRAIN_DUMP,
    currentUrl: 'loro://practice/refrain?filter=hard',
  })
  assert.equal(result.status, 'passed')
})

test('passes menu hard-filter on the empty difficult-only drill', () => {
  const result = evaluateHardRefrainDump({
    menuDump: MENU_DUMP,
    refrainDump: HARD_EMPTY_DUMP,
    currentUrl: '/practice/refrain?filter=hard',
  })
  assert.equal(result.status, 'passed')
})

test('fails menu hard-filter when chrome is the daily wave', () => {
  const result = evaluateHardRefrainDump({
    menuDump: MENU_DUMP,
    refrainDump: PHRASE_REFRAIN_DUMP,
    currentUrl: 'loro://practice/refrain?filter=hard',
  })
  assert.equal(result.status, 'failed')
})

test('records practice-back-swipe-disabled only from dump evidence as unavailable', () => {
  const result = evaluatePracticeGestureDisabledDump({
    dump: PRACTICE_DUMP,
    currentUrl: 'loro://practice/stream',
  })
  assert.equal(result.status, 'unavailable')
  assert.match(result.notes, /gestureEnabled: false/)
})

test('edge-swipe evaluation stays on the session or fails closed', () => {
  assert.equal(
    evaluatePracticeBackSwipe({ beforeDump: PRACTICE_DUMP, afterDump: PRACTICE_DUMP }).status,
    'passed',
  )
  assert.equal(
    evaluatePracticeBackSwipe({ beforeDump: PRACTICE_DUMP, afterDump: TODAY_DUMP }).status,
    'failed',
  )
  assert.equal(
    evaluatePracticeBackSwipe({ beforeDump: TODAY_DUMP, afterDump: TODAY_DUMP }).status,
    'unavailable',
  )
})

test('missing adb or device never marks a wave row passed', () => {
  const missingAdb = executeWaveScenarios({
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.equal(missingAdb.length, 3)
  assert.ok(missingAdb.every((row) => row.status === 'unavailable'))
  assert.ok(missingAdb.every((row) => row.reason.includes('adb')))

  const noDevice = executeWaveScenarios({
    run: (tool, args) => {
      if (args.includes('version')) return { status: 0, stdout: 'Android Debug Bridge' }
      if (args.includes('devices')) return { status: 0, stdout: 'List of devices attached\n' }
      assert.fail(`unexpected ${tool} ${args.join(' ')}`)
    },
  })
  assert.ok(noDevice.every((row) => row.status === 'unavailable'))
  assert.ok(noDevice.every((row) => row.reason.includes('device')))

  const probe = probeAndroidDevice({
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.match(probe.reason, /adb is not installed/)
})

test('scripted device dumps pass only with matching chrome and activity URL', () => {
  let stage = 'idle'
  const run = (_tool, args) => {
    const joined = args.join(' ')
    if (joined.includes('version')) return { status: 0, stdout: 'Android Debug Bridge' }
    if (joined.includes('devices')) {
      return { status: 0, stdout: 'List of devices attached\nemulator-5554\tdevice\n' }
    }
    if (joined.includes('am start') && joined.includes('practice/stream')) {
      stage = 'stream'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('am start') && joined.includes('MAIN')) {
      stage = 'home'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      if (stage === 'stream') stage = 'phrase'
      else if (stage === 'home') stage = 'menu'
      else if (stage === 'menu') stage = 'hard'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) {
      const xml =
        stage === 'phrase'
          ? PHRASE_REFRAIN_DUMP
          : stage === 'home'
            ? HOME_DUMP
            : stage === 'menu'
              ? MENU_DUMP
              : stage === 'hard'
                ? HARD_REFRAIN_DUMP
                : STREAM_DUMP
      return { status: 0, stdout: xml }
    }
    if (joined.includes('dumpsys')) {
      const url =
        stage === 'phrase'
          ? 'dat=loro://practice/refrain?phrase=es-001'
          : stage === 'hard'
            ? 'dat=loro://practice/refrain?filter=hard'
            : 'dat=loro://practice/stream'
      return { status: 0, stdout: url }
    }
    if (joined.includes('input swipe')) {
      stage = 'stream'
      return { status: 0, stdout: '' }
    }
    assert.fail(`unexpected adb ${joined}`)
  }
  const rows = executeWaveScenarios({ run, waitMs: 0 })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ['stream-to-phrase-refrain', 'passed'],
      ['menu-hard-refrain', 'passed'],
      ['practice-back-swipe-disabled', 'passed'],
    ],
  )
})
