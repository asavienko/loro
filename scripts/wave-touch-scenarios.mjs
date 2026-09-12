/**
 * Plan 101/93 wave-path scenarios collected by `native:evidence`.
 *
 * A screenshot of whatever is on screen is not a pass. Missing SDK or device
 * stays unavailable. Browser pointer coverage lives in the learner E2E suite.
 * Android Back is not an iOS control; that row stays unavailable there.
 */
export const WAVE_TOUCH_SCENARIOS = [
  {
    id: 'stream-to-phrase-refrain',
    owner: '101',
    requirement: 'LB-03',
    entry: 'Today Start the * wave, then Stream Practice this phrase',
    expect: '/practice/refrain?phrase=<id>',
  },
  {
    id: 'menu-hard-refrain',
    owner: '101',
    requirement: 'LB-08',
    entry: 'Switcher or More The Refrain',
    expect: '/practice/refrain?filter=hard',
  },
  {
    id: 'practice-back-swipe-disabled',
    owner: '93',
    requirement: 'NAV-04',
    entry: 'Native back-swipe on Stream or Refrain',
    expect: 'session remains; practice stack gestureEnabled false',
  },
  {
    id: 'spine-pull-opens-switcher',
    owner: '93',
    requirement: 'NAV-08',
    entry: 'Pull down the spine handle on Today',
    expect: 'switcher sheet opens',
  },
  {
    id: 'sheet-pull-dismisses-switcher',
    owner: '93',
    requirement: 'NAV-06',
    entry: 'Pull down the sheet handle on the open switcher',
    expect: 'switcher sheet dismisses; Today remains',
  },
  {
    id: 'sheet-back-dismisses-switcher',
    owner: '93',
    requirement: 'NAV-06',
    entry: 'Android Back / Modal onRequestClose on the open switcher',
    expect: 'switcher sheet dismisses; Today remains',
  },
  {
    id: 'sheet-backdrop-dismisses-switcher',
    owner: '93',
    requirement: 'NAV-06',
    entry: 'Tap the labelled Dismiss backdrop on the open switcher',
    expect: 'switcher sheet dismisses; Today remains',
  },
  {
    id: 'stream-to-phrase-refrain-at',
    owner: '101',
    requirement: 'LB-03',
    entry: 'TalkBack double-activate Today wave then Stream Practice this phrase',
    expect: '/practice/refrain?phrase=<id>',
  },
  {
    id: 'menu-hard-refrain-at',
    owner: '101',
    requirement: 'LB-08',
    entry: 'TalkBack double-activate switcher The Refrain',
    expect: '/practice/refrain?filter=hard',
  },
  {
    id: 'practice-back-swipe-disabled-at',
    owner: '93',
    requirement: 'NAV-04',
    entry: 'TalkBack-enabled edge swipe on Stream or Refrain',
    expect: 'session remains; practice stack gestureEnabled false',
  },
  {
    id: 'sheet-back-dismisses-switcher-at',
    owner: '93',
    requirement: 'NAV-06',
    entry: 'TalkBack-enabled Android Back on the open switcher',
    expect: 'switcher sheet dismisses; Today remains',
  },
  {
    id: 'sheet-backdrop-dismisses-switcher-at',
    owner: '93',
    requirement: 'NAV-06',
    entry: 'TalkBack double-activate the labelled Dismiss backdrop',
    expect: 'switcher sheet dismisses; Today remains',
  },
]

export function waveScenario(id) {
  const row = WAVE_TOUCH_SCENARIOS.find((scenario) => scenario.id === id)
  if (!row) throw new Error(`Unknown wave-touch scenario: ${id}`)
  return row
}

export function unevaluatedWaveScenarios(reason) {
  return WAVE_TOUCH_SCENARIOS.map((scenario) => ({
    ...scenario,
    status: 'unavailable',
    reason,
  }))
}
