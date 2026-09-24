import { message } from '../i18n'
export const todayCopy = {
  get title() {
    return message('today.title')
  },
  setHeading: (count: number): string => message('today.setHeading', { count }),
  lockedIn: (locked: number, total: number): string => message('today.lockedIn', { locked, total }),
  get lockedBadge() {
    return message('today.lockedBadge')
  },
  lockInDay: (day: number, days: number): string => message('today.lockInDay', { day, days }),
  streakDays: (days: number): string => message('today.streakDays', { days }),
  empty: {
    get body() {
      return message('today.empty.body')
    },
  },
  day: {
    get heading() {
      return message('today.day.heading')
    },
    get now() {
      return message('today.day.now')
    },
    reps: (count: number): string => message('today.day.reps', { count }),
    get banked() {
      return message('today.day.banked')
    },
    nextWave: (manner: string, phrases: number): string =>
      message('today.day.nextWave', { manner, phrases }),
    waveListenProgress: (heard: number, total: number): string =>
      message('today.day.waveListenProgress', { heard, total }),
    get completed() {
      return message('today.day.completed')
    },
  },
  waves: {
    morning: {
      get title() {
        return message('today.waves.morning.title')
      },
      get manner() {
        return message('today.waves.morning.manner')
      },
    },
    midday: {
      get title() {
        return message('today.waves.midday.title')
      },
      get manner() {
        return message('today.waves.midday.manner')
      },
    },
    evening: {
      get title() {
        return message('today.waves.evening.title')
      },
      get manner() {
        return message('today.waves.evening.manner')
      },
    },
  },
  rail: {
    get stream() {
      return message('today.rail.stream')
    },
    get add() {
      return message('today.rail.add')
    },
    get progress() {
      return message('today.rail.progress')
    },
  },
  switcher: {
    get title() {
      return message('today.switcher.title')
    },
    get go() {
      return message('today.switcher.go')
    },
    get here() {
      return message('today.switcher.here')
    },
  },
  wordmark: {
    get label() {
      return message('today.wordmark')
    },
  },
  rhythm: {
    cycle: (band: string): string => message('today.rhythm.cycle', { band }),
    band: {
      get morning() {
        return message('today.rhythm.band.morning')
      },
      get midday() {
        return message('today.rhythm.band.midday')
      },
      get evening() {
        return message('today.rhythm.band.evening')
      },
    },
    hello: {
      get morning() {
        return message('today.rhythm.hello.morning')
      },
      get midday() {
        return message('today.rhythm.hello.midday')
      },
      get evening() {
        return message('today.rhythm.hello.evening')
      },
    },
    get dueLead() {
      return message('today.rhythm.dueLead')
    },
    dueCount: (count: number): string => message('today.rhythm.dueCount', { count }),
    get statCadence() {
      return message('today.rhythm.statCadence')
    },
    get statLocked() {
      return message('today.rhythm.statLocked')
    },
    lockedValue: (locked: number, total: number): string =>
      message('today.rhythm.lockedValue', { locked, total }),
    get statNext() {
      return message('today.rhythm.statNext')
    },
    mixes: (count: number): string => message('today.rhythm.mixes', { count }),
    get dueNow() {
      return message('today.rhythm.dueNow')
    },
    waveIndex: (index: number): string => message('today.rhythm.waveIndex', { index }),
    get startWave() {
      return message('today.rhythm.startWave')
    },
    wavePhrases: (phrases: number): string => message('today.rhythm.wavePhrases', { phrases }),
    waveClock: (hour: number, minute: string, period: 'am' | 'pm'): string =>
      message('today.rhythm.waveClock', { hour, minute, period }),
    get jumpBack() {
      return message('today.rhythm.jumpBack')
    },
    get browse() {
      return message('today.rhythm.browse')
    },
    get insightTitle() {
      return message('today.rhythm.insightTitle')
    },
    get profile() {
      return message('today.rhythm.profile')
    },
    get target() {
      return message('today.rhythm.target')
    },
  },
  cta: {
    get empty() {
      return message('today.cta.empty')
    },
    startWave: {
      get morning() {
        return message('today.cta.startWave.morning')
      },
      get midday() {
        return message('today.cta.startWave.midday')
      },
      get evening() {
        return message('today.cta.startWave.evening')
      },
    },
    get resumeRefrain() {
      return message('today.cta.resumeRefrain')
    },
    get keepListening() {
      return message('today.cta.keepListening')
    },
  },
}
