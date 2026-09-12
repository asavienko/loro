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
]

export function unevaluatedWaveScenarios(reason) {
  return WAVE_TOUCH_SCENARIOS.map((scenario) => ({
    ...scenario,
    status: 'unavailable',
    reason,
  }))
}
