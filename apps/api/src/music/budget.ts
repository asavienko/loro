import { config } from '../common/config.js'
import type { ServerClock } from '../common/clock.js'

export interface MusicBudgetState {
  readonly monthlyMicrosUsed: number
  readonly dailyMicrosUsed: number
  readonly monthlyLimitMicros: number
  readonly dailyLimitMicros: number
}

export class MusicBudget {
  private readonly monthly = new Map<string, { month: string; micros: number }>()
  private daily = { day: '', micros: 0 }

  constructor(private readonly clock: ServerClock) {}

  remaining(principalId: string): MusicBudgetState {
    const now = this.clock.now()
    const month = utcMonth(now)
    const day = utcDay(now)
    const monthly = this.monthly.get(principalId)
    const monthlyMicrosUsed = monthly?.month === month ? monthly.micros : 0
    const dailyMicrosUsed = this.daily.day === day ? this.daily.micros : 0
    return {
      monthlyMicrosUsed,
      dailyMicrosUsed,
      monthlyLimitMicros: usdToMicros(config.musicMonthlyBudgetUsdPerUser()),
      dailyLimitMicros: usdToMicros(config.musicDailyBudgetUsdGlobal()),
    }
  }

  canSpend(principalId: string, micros: number): boolean {
    const state = this.remaining(principalId)
    if (
      state.monthlyLimitMicros > 0 &&
      state.monthlyMicrosUsed + micros > state.monthlyLimitMicros
    ) {
      return false
    }
    if (state.dailyLimitMicros > 0 && state.dailyMicrosUsed + micros > state.dailyLimitMicros) {
      return false
    }
    return true
  }

  record(principalId: string, micros: number): void {
    const now = this.clock.now()
    const month = utcMonth(now)
    const day = utcDay(now)
    const current = this.monthly.get(principalId)
    this.monthly.set(principalId, {
      month,
      micros: (current?.month === month ? current.micros : 0) + micros,
    })
    this.daily = {
      day,
      micros: (this.daily.day === day ? this.daily.micros : 0) + micros,
    }
  }
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function utcMonth(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7)
}

function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.round(usd * 1_000_000)
}
