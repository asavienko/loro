import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WAVE_SCENARIO_IDS,
  evaluateHardRefrainDump,
  evaluatePracticeBackSwipe,
  evaluatePracticeGestureDisabledDump,
  evaluateStreamPhraseDump,
  evaluateOnboardedHome,
  evaluateTodayStreamDump,
  executeWaveScenarios,
  findWaveStart,
  isOnboardingDump,
  parseUiDump,
  probeAndroidDevice,
  routeUrlFromDump,
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

const MORE_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" content-desc="The Refrain" clickable="true" bounds="[24,300][360,356]"/>
  </node>
</hierarchy>`

const EXPO_STREAM_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="loro-route:/practice/stream" bounds="[0,0][1,1]"/>
    <node class="android.widget.TextView" text="This wave" bounds="[24,200][360,248]"/>
    <node class="android.widget.Button" content-desc="Practice this phrase" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const EXPO_PHRASE_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="loro-route:/practice/refrain?phrase=es-001" bounds="[0,0][1,1]"/>
    <node class="android.widget.TextView" text="This phrase" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const EXPO_HARD_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="loro-route:/practice/refrain?filter=hard" bounds="[0,0][1,1]"/>
    <node class="android.widget.TextView" text="Difficult phrases" bounds="[24,80][360,128]"/>
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
  </node>
</hierarchy>`

const WELCOME_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="¡Hola! I'm Loro" bounds="[24,80][360,128]"/>
    <node class="android.widget.Button" text="Let's go →" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const GOAL_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" text="Just curious" clickable="true" bounds="[24,200][360,248]"/>
    <node class="android.widget.Button" text="Continue" clickable="true" enabled="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const LEVEL_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" text="Starting out" clickable="true" bounds="[24,200][360,248]"/>
    <node class="android.widget.Button" text="Continue" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const MINUTES_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" text="10 minutes" clickable="true" bounds="[24,200][360,248]"/>
    <node class="android.widget.Button" text="Continue" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const PACKS_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.Button" text="Café &amp; ordering. Everyday café phrases." clickable="true" bounds="[24,160][360,208]"/>
    <node class="android.widget.Button" text="Getting around. Directions and transport." clickable="true" bounds="[24,220][360,268]"/>
    <node class="android.widget.Button" text="Continue" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const READY_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="You're all set" bounds="[24,80][360,128]"/>
    <node class="android.widget.Button" text="Start learning 🎧" clickable="true" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const ONBOARD_SEQUENCE = [
  WELCOME_DUMP,
  GOAL_DUMP,
  GOAL_DUMP,
  LEVEL_DUMP,
  LEVEL_DUMP,
  MINUTES_DUMP,
  MINUTES_DUMP,
  PACKS_DUMP,
  PACKS_DUMP,
  PACKS_DUMP,
  READY_DUMP,
  HOME_DUMP,
]

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

test('finds Today Start the * wave and Keep listening', () => {
  assert.equal(findWaveStart(HOME_DUMP)?.text, 'Start the morning wave')
  assert.equal(findWaveStart(TODAY_DUMP)?.text, 'Start the morning wave')
  const keep = `<?xml version="1.0"?><hierarchy><node text="Keep listening" bounds="[24,400][360,456]"/></hierarchy>`
  assert.equal(findWaveStart(keep)?.text, 'Keep listening')
  assert.equal(findWaveStart(STREAM_DUMP), undefined)
})

test('passes Today → Stream when chrome and URL match', () => {
  const result = evaluateTodayStreamDump({
    todayDump: HOME_DUMP,
    streamDump: STREAM_DUMP,
    currentUrl: 'loro://practice/stream',
  })
  assert.equal(result.status, 'passed')
})

test('never treats a dump-only Today hop as a device pass', () => {
  const result = evaluateTodayStreamDump({
    todayDump: HOME_DUMP,
    streamDump: STREAM_DUMP,
    currentUrl: '',
  })
  assert.equal(result.status, 'unavailable')
})

test('fails Today → Stream when the URL stays on Today', () => {
  const result = evaluateTodayStreamDump({
    todayDump: HOME_DUMP,
    streamDump: HOME_DUMP,
    currentUrl: 'loro://',
  })
  assert.equal(result.status, 'failed')
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

test('reads the Expo path from a hidden loro-route dump node', () => {
  assert.equal(routeUrlFromDump(EXPO_STREAM_DUMP), '/practice/stream')
  assert.equal(routeUrlFromDump(EXPO_PHRASE_DUMP), '/practice/refrain?phrase=es-001')
  assert.equal(routeUrlFromDump(STREAM_DUMP), '')
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
    if (joined.includes('am start') && joined.includes('://more')) {
      stage = 'more'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('am start') && joined.includes('MAIN')) {
      stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      const tapY = Number(args.at(-1))
      if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
      else if (stage === 'stream') stage = 'phrase'
      else if (stage === 'menu' || stage === 'more') stage = 'hard'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) {
      const xml =
        stage === 'phrase'
          ? PHRASE_REFRAIN_DUMP
          : stage === 'today'
            ? HOME_DUMP
            : stage === 'menu'
              ? MENU_DUMP
              : stage === 'more'
                ? MORE_DUMP
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

test('in-app Expo pushes pass from loro-route dump when dumpsys has no dat=', () => {
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
    if (joined.includes('am start') && joined.includes('://more')) {
      stage = 'more'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('am start') && joined.includes('MAIN')) {
      stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      const tapY = Number(args.at(-1))
      if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
      else if (stage === 'stream') stage = 'phrase'
      else if (stage === 'menu' || stage === 'more') stage = 'hard'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) {
      const xml =
        stage === 'phrase'
          ? EXPO_PHRASE_DUMP
          : stage === 'today'
            ? HOME_DUMP
            : stage === 'menu'
              ? MENU_DUMP
              : stage === 'more'
                ? MORE_DUMP
                : stage === 'hard'
                  ? EXPO_HARD_DUMP
                  : EXPO_STREAM_DUMP
      return { status: 0, stdout: xml }
    }
    if (joined.includes('dumpsys')) {
      return { status: 0, stdout: 'ACTIVITY MANAGER ACTIVITIES (dumpsys activity activities)' }
    }
    if (joined.includes('input swipe')) {
      stage = 'stream'
      return { status: 0, stdout: '' }
    }
    assert.fail(`unexpected adb ${joined}`)
  }
  const rows = executeWaveScenarios({ run, waitMs: 0 })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status, row.currentUrl]),
    [
      ['stream-to-phrase-refrain', 'passed', '/practice/refrain?phrase=es-001'],
      ['menu-hard-refrain', 'passed', '/practice/refrain?filter=hard'],
      ['practice-back-swipe-disabled', 'passed', undefined],
    ],
  )
})

test('menu-hard-refrain fails when More does not open the difficult-only drill', () => {
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
    if (joined.includes('am start') && joined.includes('://more')) {
      stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('am start') && joined.includes('MAIN')) {
      stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      const tapY = Number(args.at(-1))
      if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
      else if (stage === 'stream') stage = 'phrase'
      else if (stage === 'menu') stage = 'hard'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) {
      const xml =
        stage === 'phrase'
          ? PHRASE_REFRAIN_DUMP
          : stage === 'today'
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
  assert.equal(rows[0].status, 'passed')
  assert.equal(rows[1].status, 'failed')
  assert.match(rows[1].notes, /The Refrain/)
})

test('detects onboarding chrome and treats Today as the ready home', () => {
  assert.equal(isOnboardingDump(WELCOME_DUMP), true)
  assert.equal(isOnboardingDump(READY_DUMP), true)
  assert.equal(isOnboardingDump(HOME_DUMP), false)
  assert.equal(evaluateOnboardedHome(HOME_DUMP).status, 'passed')
  assert.equal(evaluateOnboardedHome(WELCOME_DUMP).status, 'failed')
  assert.equal(evaluateOnboardedHome(STREAM_DUMP).status, 'unavailable')
})

test('decodes pack labels so Café & ordering is tappable from a uiautomator dump', () => {
  const node = parseUiDump(PACKS_DUMP).nodes.find((entry) => entry.text.includes('Café'))
  assert.match(node.text, /Café & ordering/)
})

test('completes first-run onboarding before driving the three wave rows', () => {
  let onboardIndex = 0
  let stage = 'today'
  const last = ONBOARD_SEQUENCE.length - 1
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
    if (joined.includes('am start') && joined.includes('://more')) {
      stage = 'more'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('am start') && joined.includes('MAIN')) {
      if (onboardIndex >= last) stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      if (onboardIndex < last) {
        onboardIndex += 1
        return { status: 0, stdout: '' }
      }
      const tapY = Number(args.at(-1))
      if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
      else if (stage === 'stream') stage = 'phrase'
      else if (stage === 'menu' || stage === 'more') stage = 'hard'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) {
      if (onboardIndex < last) return { status: 0, stdout: ONBOARD_SEQUENCE[onboardIndex] }
      const xml =
        stage === 'phrase'
          ? PHRASE_REFRAIN_DUMP
          : stage === 'today'
            ? HOME_DUMP
            : stage === 'menu'
              ? MENU_DUMP
              : stage === 'more'
                ? MORE_DUMP
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
  assert.equal(onboardIndex, last)
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ['stream-to-phrase-refrain', 'passed'],
      ['menu-hard-refrain', 'passed'],
      ['practice-back-swipe-disabled', 'passed'],
    ],
  )
})

test('wave rows stay unavailable when first-run onboarding cannot finish', () => {
  const run = (_tool, args) => {
    const joined = args.join(' ')
    if (joined.includes('version')) return { status: 0, stdout: 'Android Debug Bridge' }
    if (joined.includes('devices')) {
      return { status: 0, stdout: 'List of devices attached\nemulator-5554\tdevice\n' }
    }
    if (joined.includes('am start')) return { status: 0, stdout: '' }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (joined.includes('cat')) return { status: 0, stdout: WELCOME_DUMP }
    if (joined.includes('input tap')) return { status: 0, stdout: '' }
    assert.fail(`unexpected adb ${joined}`)
  }
  const rows = executeWaveScenarios({ run, waitMs: 0 })
  assert.equal(rows.length, 3)
  assert.ok(rows.every((row) => row.status === 'unavailable'))
  assert.ok(rows.every((row) => row.reason.includes('Onboarding')))
})
