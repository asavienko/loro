import { config } from '../common/config.js'

export interface MusicBudgetState {
  readonly monthlyMicrosUsed: number
  readonly dailyMicrosUsed: number
  readonly monthlyLimitMicros: number
  readonly dailyLimitMicros: number
}

export class MusicBudget {
  private readonly monthly = new Map<string, number>()
  private daily = 0

  remaining(principalId: string): MusicBudgetState {
    const monthlyLimit = usdToMicros(config.musicMonthlyBudgetUsdPerUser())
    const dailyLimit = usdToMicros(config.musicDailyBudgetUsdGlobal())
    return {
      monthlyMicrosUsed: this.monthly.get(principalId) ?? 0,
      dailyMicrosUsed: this.daily,
      monthlyLimitMicros: monthlyLimit,
      dailyLimitMicros: dailyLimit,
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
    this.monthly.set(principalId, (this.monthly.get(principalId) ?? 0) + micros)
    this.daily += micros
  }
}

function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.round(usd * 1_000_000)
}
