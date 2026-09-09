import { message } from '../i18n'
export const onboardingCopy = {
  goalValue: (goal: string): string => message('onboarding.goalValue', { goal }),
  welcome: {
    emoji: '🦜',
    get greeting() {
      return message('onboarding.welcome.greeting')
    },
    get title() {
      return message('onboarding.welcome.title')
    },
    get body() {
      return message('onboarding.welcome.body')
    },
  },
  steps: {
    goal: {
      get question() {
        return message('onboarding.steps.goal.question')
      },
      get helper() {
        return message('onboarding.steps.goal.helper')
      },
      options: {
        trip: {
          emoji: '🧳',
          get label() {
            return message('onboarding.steps.goal.options.trip.label')
          },
          get sub() {
            return message('onboarding.steps.goal.options.trip.sub')
          },
        },
        convo: {
          emoji: '💬',
          get label() {
            return message('onboarding.steps.goal.options.convo.label')
          },
          get sub() {
            return message('onboarding.steps.goal.options.convo.sub')
          },
        },
        move: {
          emoji: '🌍',
          get label() {
            return message('onboarding.steps.goal.options.move.label')
          },
          get sub() {
            return message('onboarding.steps.goal.options.move.sub')
          },
        },
        curious: {
          emoji: '🪶',
          get label() {
            return message('onboarding.steps.goal.options.curious.label')
          },
          get sub() {
            return message('onboarding.steps.goal.options.curious.sub')
          },
        },
      },
    },
    level: {
      get question() {
        return message('onboarding.steps.level.question')
      },
      get helper() {
        return message('onboarding.steps.level.helper')
      },
      options: {
        beg: {
          emoji: '🌱',
          get label() {
            return message('onboarding.steps.level.options.beg.label')
          },
          get sub() {
            return message('onboarding.steps.level.options.beg.sub')
          },
        },
        some: {
          emoji: '🌿',
          get label() {
            return message('onboarding.steps.level.options.some.label')
          },
          get sub() {
            return message('onboarding.steps.level.options.some.sub')
          },
        },
        conf: {
          emoji: '🌳',
          get label() {
            return message('onboarding.steps.level.options.conf.label')
          },
          get sub() {
            return message('onboarding.steps.level.options.conf.sub')
          },
        },
      },
    },
    mins: {
      get question() {
        return message('onboarding.steps.mins.question')
      },
      get helper() {
        return message('onboarding.steps.mins.helper')
      },
      options: {
        '5': {
          emoji: '⚡',
          get label() {
            return message('onboarding.steps.mins.options.5.label')
          },
          get sub() {
            return message('onboarding.steps.mins.options.5.sub')
          },
        },
        '10': {
          emoji: '🔥',
          get label() {
            return message('onboarding.steps.mins.options.10.label')
          },
          get sub() {
            return message('onboarding.steps.mins.options.10.sub')
          },
        },
        '20': {
          emoji: '🚀',
          get label() {
            return message('onboarding.steps.mins.options.20.label')
          },
          get sub() {
            return message('onboarding.steps.mins.options.20.sub')
          },
        },
      },
    },
    packs: {
      get question() {
        return message('onboarding.steps.packs.question')
      },
      get helper() {
        return message('onboarding.steps.packs.helper')
      },
    },
  },
  packSub: (phrases: number): string => message('onboarding.packSub', { phrases }),
  ready: {
    emoji: '✅',
    get title() {
      return message('onboarding.ready.title')
    },
    seeded: (count: number): string => message('onboarding.ready.seeded', { count }),
    sessionReady: (mins: string): string => message('onboarding.ready.sessionReady', { mins }),
    summary: {
      get level() {
        return message('onboarding.ready.summary.level')
      },
      get goal() {
        return message('onboarding.ready.summary.goal')
      },
      get daily() {
        return message('onboarding.ready.summary.daily')
      },
      get packs() {
        return message('onboarding.ready.summary.packs')
      },
      minutes: (mins: string): string => message('onboarding.ready.summary.minutes', { mins }),
      packsSelected: (count: number): string =>
        message('onboarding.ready.summary.packsSelected', { count }),
    },
  },
  cta: {
    get welcome() {
      return message('onboarding.cta.welcome')
    },
    get next() {
      return message('onboarding.cta.next')
    },
    get ready() {
      return message('onboarding.cta.ready')
    },
  },
}
