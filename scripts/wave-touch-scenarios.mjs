/**
 * Plan 101 wave-path scenarios collected by `native:evidence`.
 *
 * A screenshot of whatever is on screen is not a pass. Missing SDK or device
 * stays unavailable. Browser pointer coverage lives in the learner E2E suite.
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
]

export function unevaluatedWaveScenarios(reason) {
  return WAVE_TOUCH_SCENARIOS.map((scenario) => ({
    ...scenario,
    status: 'unavailable',
    reason,
  }))
}
