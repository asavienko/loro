import { afterEach, describe, expect, it } from 'vitest'
import { MusicBudget } from './budget.js'

describe('separate music budget keys', () => {
  const previousMonthly = process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER']
  const previousDaily = process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL']

  afterEach(() => {
    if (previousMonthly === undefined) delete process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER']
    else process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = previousMonthly
    if (previousDaily === undefined) delete process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL']
    else process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = previousDaily
  })

  it('does not share the AI scene budget and can exhaust independently', () => {
    process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = '0.000001'
    process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = '1'
    const budget = new MusicBudget()
    expect(budget.canSpend('user-a', 1)).toBe(true)
    budget.record('user-a', 1)
    expect(budget.canSpend('user-a', 1)).toBe(false)
    expect(budget.canSpend('user-b', 1)).toBe(true)
  })
})
