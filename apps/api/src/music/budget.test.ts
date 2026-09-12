import { afterEach, describe, expect, it } from 'vitest'
import { MusicBudget } from './budget.js'

const start = Date.UTC(2026, 8, 12, 12, 0, 0)

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
    const budget = new MusicBudget({ now: () => start })
    expect(budget.canSpend('user-a', 1)).toBe(true)
    budget.record('user-a', 1)
    expect(budget.canSpend('user-a', 1)).toBe(false)
    expect(budget.canSpend('user-b', 1)).toBe(true)
  })

  it('rolls daily spend at the next UTC day', () => {
    process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = '1'
    process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = '0.000001'
    let now = start
    const budget = new MusicBudget({ now: () => now })
    budget.record('user-a', 1)
    expect(budget.canSpend('user-a', 1)).toBe(false)
    now = start + 12 * 60 * 60 * 1000
    expect(budget.canSpend('user-a', 1)).toBe(false)
    now = Date.UTC(2026, 8, 13, 0, 0, 0)
    expect(budget.canSpend('user-a', 1)).toBe(true)
  })

  it('rolls monthly spend at the next UTC month', () => {
    process.env['MUSIC_MONTHLY_BUDGET_USD_PER_USER'] = '0.000001'
    process.env['MUSIC_DAILY_BUDGET_USD_GLOBAL'] = '1'
    let now = Date.UTC(2026, 8, 30, 12, 0, 0)
    const budget = new MusicBudget({ now: () => now })
    budget.record('user-a', 1)
    expect(budget.canSpend('user-a', 1)).toBe(false)
    now = Date.UTC(2026, 9, 1, 0, 0, 0)
    expect(budget.canSpend('user-a', 1)).toBe(true)
  })
})
