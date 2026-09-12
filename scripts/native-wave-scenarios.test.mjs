import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WAVE_SCENARIO_IDS,
  evaluateHardRefrainDump,
  evaluatePracticeBackSwipe,
  evaluatePracticeGestureDisabledDump,
  evaluateStreamPhraseDump,
  evaluateOnboardedHome,
  evaluateSheetBackDismiss,
  evaluateSheetBackdropDismiss,
  evaluateSheetDismiss,
  evaluateSpinePull,
  evaluateTodayStreamDump,
  executeWaveScenarios,
  dumpHasSwitcher,
  isTodayHomeDump,
  findClickableLabel,
  findLabel,
  findResourceId,
  findWaveStart,
  isOnboardingDump,
  parseUiDump,
  probeAndroidDevice,
  routeUrlFromDump,
  routeUrlFromLogcat,
  tapBounds,
  tapDismissBounds,
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
    <node class="android.widget.Button" content-desc="Dismiss" clickable="true" bounds="[0,0][360,70]"/>
    <node resource-id="sheet-pull-handle" bounds="[24,80][360,140]"/>
    <node class="android.widget.TextView" text="Where to?" bounds="[24,160][360,200]"/>
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
    <node resource-id="navigation-pull-handle" bounds="[0,0][360,88]"/>
    <node class="android.widget.Button" content-desc="Spanish, open the menu" clickable="true" bounds="[24,40][360,88]"/>
    <node class="android.widget.Button" text="Start the morning wave" bounds="[24,400][360,456]"/>
  </node>
</hierarchy>`

const TODAY_RESUME_DUMP = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node resource-id="navigation-pull-handle" bounds="[0,0][360,88]"/>
    <node class="android.widget.TextView" text="Today" bounds="[24,40][200,88]"/>
    <node class="android.widget.Button" content-desc="Today, open the menu" clickable="true" bounds="[24,40][360,88]"/>
    <node class="android.widget.Button" text="Resume practice" clickable="true" bounds="[24,200][360,256]"/>
    <node class="android.widget.Button" content-desc="Stream, 10 phrases" clickable="true" bounds="[24,1600][180,1680]"/>
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

test('lists the 101/93 pointer, shell, and TalkBack rows', () => {
  assert.deepEqual(WAVE_SCENARIO_IDS, [
    'stream-to-phrase-refrain',
    'menu-hard-refrain',
    'practice-back-swipe-disabled',
    'spine-pull-opens-switcher',
    'sheet-pull-dismisses-switcher',
    'sheet-back-dismisses-switcher',
    'sheet-backdrop-dismisses-switcher',
    'stream-to-phrase-refrain-at',
    'menu-hard-refrain-at',
    'practice-back-swipe-disabled-at',
    'sheet-back-dismisses-switcher-at',
    'sheet-backdrop-dismisses-switcher-at',
  ])
})

test('parses bounds and taps the control centre', () => {
  const dump = parseUiDump(STREAM_DUMP)
  const tap = tapBounds(dump, 'Practice this phrase')
  assert.deepEqual(tap, { x: 192, y: 428 })
})

test('prefers a tappable The Refrain over the current-row title', () => {
  const dump = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,140][360,188]"/>
    <node class="android.widget.Button" content-desc="The Refrain" clickable="true" bounds="[24,300][360,356]"/>
  </node>
</hierarchy>`
  assert.equal(findLabel(dump, 'The Refrain')?.clickable, true)
  assert.equal(findClickableLabel(dump, 'The Refrain')?.clickable, true)
  assert.deepEqual(tapBounds(dump, 'The Refrain'), { x: 192, y: 328 })
})

test('finds Today Start the * wave and Keep listening', () => {
  assert.equal(findWaveStart(HOME_DUMP)?.text, 'Start the morning wave')
  assert.equal(findWaveStart(TODAY_DUMP)?.text, 'Start the morning wave')
  const keep = `<?xml version="1.0"?><hierarchy><node text="Keep listening" bounds="[24,400][360,456]"/></hierarchy>`
  assert.equal(findWaveStart(keep)?.text, 'Keep listening')
  assert.equal(findWaveStart(STREAM_DUMP), undefined)
  assert.equal(isTodayHomeDump(TODAY_RESUME_DUMP), true)
  assert.equal(findWaveStart(TODAY_RESUME_DUMP), undefined)
})

test('passes Today → Stream when chrome and URL match', () => {
  const result = evaluateTodayStreamDump({
    todayDump: HOME_DUMP,
    streamDump: STREAM_DUMP,
    currentUrl: 'loro://practice/stream',
  })
  assert.equal(result.status, 'passed')
  assert.equal(
    evaluateTodayStreamDump({
      todayDump: TODAY_RESUME_DUMP,
      streamDump: STREAM_DUMP,
      currentUrl: 'loro://practice/stream',
    }).status,
    'passed',
  )
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

test('fails menu hard-filter when The Refrain is only the here row', () => {
  const hereMenu = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node class="android.widget.TextView" text="The Refrain" bounds="[24,300][360,356]"/>
    <node class="android.widget.TextView" text="You're here" bounds="[280,300][360,356]"/>
  </node>
</hierarchy>`
  const result = evaluateHardRefrainDump({
    menuDump: hereMenu,
    refrainDump: HARD_REFRAIN_DUMP,
    currentUrl: '/practice/refrain?filter=hard',
  })
  assert.equal(result.status, 'failed')
  assert.match(result.notes, /tappable The Refrain/)
})

test('records practice-back-swipe-disabled only from dump evidence as unavailable', () => {
  const result = evaluatePracticeGestureDisabledDump({
    dump: PRACTICE_DUMP,
    currentUrl: 'loro://practice/stream',
  })
  assert.equal(result.status, 'unavailable')
  assert.match(result.notes, /gestureEnabled: false/)
})

test('spine pull opens the switcher only on a committed vertical drag', () => {
  const closed = HOME_DUMP
  const opened = MENU_DUMP
  assert.equal(
    evaluateSpinePull({ beforeDump: closed, afterDump: opened, inertDump: closed }).status,
    'passed',
  )
  assert.equal(
    evaluateSpinePull({ beforeDump: closed, afterDump: opened, inertDump: opened }).status,
    'failed',
  )
  assert.equal(
    evaluateSpinePull({ beforeDump: closed, afterDump: closed, inertDump: closed }).status,
    'failed',
  )
  assert.equal(findResourceId(HOME_DUMP, 'navigation-pull-handle')?.resourceId, 'navigation-pull-handle')
})

test('taps the Dismiss backdrop in the upper scrim, not the sheet centre', () => {
  assert.deepEqual(tapDismissBounds(MENU_DUMP), { x: 180, y: 17 })
  assert.equal(tapDismissBounds(HOME_DUMP), null)
})

test('sheet pull dismisses the switcher only on a committed vertical drag', () => {
  assert.equal(
    evaluateSheetDismiss({ menuDump: MENU_DUMP, afterDump: HOME_DUMP, inertDump: MENU_DUMP })
      .status,
    'passed',
  )
  assert.equal(
    evaluateSheetDismiss({ menuDump: MENU_DUMP, afterDump: HOME_DUMP, inertDump: HOME_DUMP })
      .status,
    'failed',
  )
  assert.equal(
    evaluateSheetDismiss({ menuDump: MENU_DUMP, afterDump: MENU_DUMP, inertDump: MENU_DUMP })
      .status,
    'failed',
  )
  assert.equal(
    evaluateSheetDismiss({
      menuDump: MENU_DUMP,
      afterDump: TODAY_RESUME_DUMP,
      inertDump: MENU_DUMP,
    }).status,
    'passed',
  )
  assert.equal(dumpHasSwitcher(MENU_DUMP), true)
  assert.equal(dumpHasSwitcher(HOME_DUMP), false)
})

test('Android Back and backdrop dismiss close the switcher on Today', () => {
  assert.equal(
    evaluateSheetBackDismiss({ menuDump: MENU_DUMP, afterDump: HOME_DUMP }).status,
    'passed',
  )
  assert.equal(
    evaluateSheetBackDismiss({ menuDump: MENU_DUMP, afterDump: MENU_DUMP }).status,
    'failed',
  )
  assert.equal(
    evaluateSheetBackDismiss({ menuDump: HOME_DUMP, afterDump: HOME_DUMP }).status,
    'unavailable',
  )
  assert.equal(
    evaluateSheetBackdropDismiss({ menuDump: MENU_DUMP, afterDump: HOME_DUMP }).status,
    'passed',
  )
  assert.equal(
    evaluateSheetBackdropDismiss({ menuDump: MENU_DUMP, afterDump: TODAY_RESUME_DUMP }).status,
    'passed',
  )
  const noDismiss = `<?xml version="1.0"?>
<hierarchy>
  <node class="android.widget.FrameLayout">
    <node resource-id="sheet-pull-handle" bounds="[24,80][360,140]"/>
    <node class="android.widget.TextView" text="Where to?" bounds="[24,160][360,200]"/>
  </node>
</hierarchy>`
  assert.equal(
    evaluateSheetBackdropDismiss({ menuDump: noDismiss, afterDump: HOME_DUMP }).status,
    'unavailable',
  )
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

function expectedPointerAndShell(status = 'passed') {
  return [
    ['stream-to-phrase-refrain', status],
    ['menu-hard-refrain', status],
    ['practice-back-swipe-disabled', status],
    ['spine-pull-opens-switcher', status],
    ['sheet-pull-dismisses-switcher', status],
    ['sheet-back-dismisses-switcher', status],
    ['sheet-backdrop-dismisses-switcher', status],
  ]
}

function expectedTalkbackRows(status = 'passed') {
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

function scriptedDevice({
  expoRoutes = false,
  moreOpensHard = true,
  talkbackInstalled = false,
} = {}) {
  let stage = 'idle'
  let talkbackEnabled = false
  let pendingFocus = null
  const streamDump = expoRoutes ? EXPO_STREAM_DUMP : STREAM_DUMP
  const phraseDump = expoRoutes ? EXPO_PHRASE_DUMP : PHRASE_REFRAIN_DUMP
  const hardDump = expoRoutes ? EXPO_HARD_DUMP : HARD_REFRAIN_DUMP
  const dumpFor = () => {
    if (stage === 'phrase') return phraseDump
    if (stage === 'today') return HOME_DUMP
    if (stage === 'menu') return MENU_DUMP
    if (stage === 'more') return MORE_DUMP
    if (stage === 'hard') return hardDump
    return streamDump
  }
  const applyTap = (tapY) => {
    if (stage === 'today') stage = tapY < 200 ? 'menu' : 'stream'
    else if (stage === 'stream') stage = 'phrase'
    else if (stage === 'menu') stage = tapY < 80 ? 'today' : 'hard'
    else if (stage === 'more') stage = 'hard'
  }
  return (_tool, args) => {
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
      stage = moreOpensHard ? 'more' : 'today'
      return { status: 0, stdout: '' }
    }
    if (
      joined.includes('am start') &&
      (joined.includes('MAIN') || args.includes('loro://') || joined.includes('loro:// '))
    ) {
      stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input tap')) {
      const tapY = Number(args.at(-1))
      const point = `${args.at(-2)},${tapY}`
      if (talkbackEnabled) {
        pendingFocus = point
        return { status: 0, stdout: '' }
      }
      applyTap(tapY)
      return { status: 0, stdout: '' }
    }
    if (joined.includes('KEYCODE_BACK')) {
      if (stage === 'menu') stage = 'today'
      return { status: 0, stdout: '' }
    }
    if (joined.includes('keyevent')) {
      if (talkbackEnabled && pendingFocus) {
        applyTap(Number(pendingFocus.split(',')[1]))
        pendingFocus = null
      }
      return { status: 0, stdout: '' }
    }
    if (joined.includes('uiautomator dump')) return { status: 0, stdout: '' }
    if (args.includes('cat')) return { status: 0, stdout: dumpFor() }
    if (joined.includes('dumpsys')) {
      if (expoRoutes) {
        return { status: 0, stdout: 'ACTIVITY MANAGER ACTIVITIES (dumpsys activity activities)' }
      }
      const url =
        stage === 'phrase'
          ? 'dat=loro://practice/refrain?phrase=es-001'
          : stage === 'hard'
            ? 'dat=loro://practice/refrain?filter=hard'
            : 'dat=loro://practice/stream'
      return { status: 0, stdout: url }
    }
    if (joined.includes('logcat')) return { status: 0, stdout: '' }
    if (joined.includes('pm list')) {
      return {
        status: 0,
        stdout: talkbackInstalled ? 'package:com.google.android.marvin.talkback\n' : '',
      }
    }
    if (joined.includes('pm grant')) return { status: 0, stdout: '' }
    if (joined.includes('settings')) {
      if (joined.includes('accessibility_enabled') && joined.endsWith('1')) talkbackEnabled = true
      if (joined.includes('accessibility_enabled') && joined.endsWith('0')) talkbackEnabled = false
      if (joined.includes('delete')) talkbackEnabled = false
      return { status: 0, stdout: '' }
    }
    if (joined.includes('input swipe')) {
      const swipeAt = args.indexOf('swipe')
      const x1 = Number(args[swipeAt + 1])
      const x2 = Number(args[swipeAt + 3])
      const y1 = Number(args[swipeAt + 2])
      const y2 = Number(args[swipeAt + 4])
      const committed = Math.abs(y2 - y1) >= 48 && Math.abs(x2 - x1) < 40
      if (x1 > 20 && committed && stage === 'today') stage = 'menu'
      else if (x1 > 20 && committed && stage === 'menu') stage = 'today'
      return { status: 0, stdout: '' }
    }
    assert.fail(`unexpected adb ${joined}`)
  }
}

test('missing adb or device never marks a wave row passed', () => {
  const missingAdb = executeWaveScenarios({
    run: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
  })
  assert.equal(missingAdb.length, WAVE_SCENARIO_IDS.length)
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
  assert.equal(
    routeUrlFromDump(
      `<?xml version="1.0"?><hierarchy><node resource-id="loro-route:/practice/stream"/></hierarchy>`,
    ),
    '/practice/stream',
  )
  assert.equal(
    routeUrlFromLogcat('ReactNativeJS: loro-route:/practice/refrain?filter=hard'),
    '/practice/refrain?filter=hard',
  )
})

test('scripted device dumps pass only with matching chrome and activity URL', () => {
  const rows = executeWaveScenarios({ run: scriptedDevice(), waitMs: 0 })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ...expectedPointerAndShell('passed'),
      ...expectedTalkbackRows('unavailable'),
    ],
  )
  assert.ok(atRows(rows).every((row) => row.reason.includes('TalkBack is not installed')))
})

test('in-app Expo pushes pass from loro-route dump when dumpsys has no dat=', () => {
  const rows = executeWaveScenarios({ run: scriptedDevice({ expoRoutes: true }), waitMs: 0 })
  assert.deepEqual(
    rows
      .filter((row) => !row.id.endsWith('-at'))
      .map((row) => [row.id, row.status, row.currentUrl]),
    [
      ['stream-to-phrase-refrain', 'passed', '/practice/refrain?phrase=es-001'],
      ['menu-hard-refrain', 'passed', '/practice/refrain?filter=hard'],
      ['practice-back-swipe-disabled', 'passed', undefined],
      ['spine-pull-opens-switcher', 'passed', undefined],
      ['sheet-pull-dismisses-switcher', 'passed', undefined],
      ['sheet-back-dismisses-switcher', 'passed', undefined],
      ['sheet-backdrop-dismisses-switcher', 'passed', undefined],
    ],
  )
  assert.ok(atRows(rows).every((row) => row.status === 'unavailable'))
})

test('menu-hard-refrain fails when More does not open the difficult-only drill', () => {
  const rows = executeWaveScenarios({ run: scriptedDevice({ moreOpensHard: false }), waitMs: 0 })
  assert.equal(rows[0].status, 'passed')
  assert.equal(rows[1].status, 'failed')
  assert.match(rows[1].notes, /The Refrain/)
  assert.equal(rows[3].status, 'passed')
  assert.equal(rows[4].status, 'passed')
  assert.equal(rows[5].status, 'passed')
  assert.equal(rows[6].status, 'passed')
})

test('TalkBack rows reuse the same chrome and URL gates after a focused activate', () => {
  const rows = executeWaveScenarios({ run: scriptedDevice({ talkbackInstalled: true }), waitMs: 0 })
  assert.deepEqual(
    rows.map((row) => [row.id, row.status]),
    [
      ...expectedPointerAndShell('passed'),
      ...expectedTalkbackRows('passed'),
    ],
  )
})

test('detects onboarding chrome and treats Today as the ready home', () => {
  assert.equal(isOnboardingDump(WELCOME_DUMP), true)
  assert.equal(isOnboardingDump(READY_DUMP), true)
  assert.equal(isOnboardingDump(HOME_DUMP), false)
  assert.equal(evaluateOnboardedHome(HOME_DUMP).status, 'passed')
  assert.equal(evaluateOnboardedHome(TODAY_RESUME_DUMP).status, 'passed')
  assert.equal(evaluateOnboardedHome(WELCOME_DUMP).status, 'failed')
  assert.equal(evaluateOnboardedHome(STREAM_DUMP).status, 'unavailable')
  assert.equal(evaluateOnboardedHome(HARD_REFRAIN_DUMP).status, 'unavailable')
})

test('decodes pack labels so Café & ordering is tappable from a uiautomator dump', () => {
  const node = parseUiDump(PACKS_DUMP).nodes.find((entry) => entry.text.includes('Café'))
  assert.match(node.text, /Café & ordering/)
})

test('completes first-run onboarding before driving the wave rows', () => {
  let onboardIndex = 0
  const last = ONBOARD_SEQUENCE.length - 1
  const device = scriptedDevice()
  const run = (tool, args) => {
    const joined = args.join(' ')
    if (joined.includes('input tap') && onboardIndex < last) {
      onboardIndex += 1
      return { status: 0, stdout: '' }
    }
    if (args.includes('cat') && onboardIndex < last) {
      return { status: 0, stdout: ONBOARD_SEQUENCE[onboardIndex] }
    }
    return device(tool, args)
  }
  const rows = executeWaveScenarios({ run, waitMs: 0 })
  assert.equal(onboardIndex, last)
  assert.deepEqual(
    rows.filter((row) => !row.id.endsWith('-at')).map((row) => [row.id, row.status]),
    expectedPointerAndShell('passed'),
  )
  assert.ok(atRows(rows).every((row) => row.status === 'unavailable'))
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
    if (args.includes('cat')) return { status: 0, stdout: WELCOME_DUMP }
    if (joined.includes('input tap')) return { status: 0, stdout: '' }
    assert.fail(`unexpected adb ${joined}`)
  }
  const rows = executeWaveScenarios({ run, waitMs: 0 })
  assert.equal(rows.length, WAVE_SCENARIO_IDS.length)
  assert.ok(rows.every((row) => row.status === 'unavailable'))
  assert.ok(rows.every((row) => row.reason.includes('Onboarding')))
})
