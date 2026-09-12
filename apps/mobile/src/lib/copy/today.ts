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
    get resumePractice() {
      return message('today.cta.resumePractice')
    },
    waitForWave: (time: string): string => message('today.cta.waitForWave', { time }),
    get complete() {
      return message('today.cta.complete')
    },
  },
}
