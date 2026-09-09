/** F-08. Reactive readers translate at access time; domain and UI layers share this adapter. */
import { message, formatBuckets, currentNativeLanguage } from './i18n'
import { persistenceCopy } from './i18n/persistence'
export const copy = {
  persistence: persistenceCopy,
  account: {
    backend: {
      get checking() {
        return message('account.backend.checking')
      },
      get connected() {
        return message('account.backend.connected')
      },
      get unavailable() {
        return message('account.backend.unavailable')
      },
      get unconfigured() {
        return message('account.backend.unconfigured')
      },
      get scope() {
        return message('account.backend.scope')
      },
      get retry() {
        return message('account.backend.retry')
      },
    },
    get google() {
      return message('account.google')
    },
    get apple() {
      return message('account.apple')
    },
    get localData() {
      return message('account.localData')
    },
    get busy() {
      return message('account.busy')
    },
    get error() {
      return message('account.error')
    },
    get 'provider-error'() {
      return message('account.error')
    },
    get cancelled() {
      return message('account.cancelled')
    },
    get localSignOut() {
      return message('account.localSignOut')
    },
    get retry() {
      return message('account.retry')
    },
    get providersUnavailable() {
      return message('account.providersUnavailable')
    },
    get 'upgrade-sign-in'() {
      return message('account.upgrade-sign-in')
    },
    get 'upgrade-offline'() {
      return message('account.upgrade-offline')
    },
    get title() {
      return message('account.title')
    },
    get intro() {
      return message('account.intro')
    },
    get email() {
      return message('account.email')
    },
    get code() {
      return message('account.codeLabel')
    },
    get send() {
      return message('account.send')
    },
    get verify() {
      return message('account.verify')
    },
    get sent() {
      return message('account.sent')
    },
    get working() {
      return message('account.working')
    },
    get signedIn() {
      return message('account.signedIn')
    },
    get signOut() {
      return message('account.signOut')
    },
    get signOutNote() {
      return message('account.signOutNote')
    },
    get syncNow() {
      return message('account.syncNow')
    },
    get syncing() {
      return message('account.syncing')
    },
    get synced() {
      return message('account.synced')
    },
    get syncPending() {
      return message('account.syncPending')
    },
    get syncError() {
      return message('account.syncError')
    },
    get unconfigured() {
      return message('account.unconfigured')
    },
    get network() {
      return message('account.network')
    },
    get 'rate-limited'() {
      return message('account.rate-limited')
    },
    get 'invalid-email'() {
      return message('account.invalid-email')
    },
    get 'invalid-code'() {
      return message('account.invalid-code')
    },
    get unavailable() {
      return message('account.unavailable')
    },
    get 'account-mismatch'() {
      return message('account.account-mismatch')
    },
    get storage() {
      return message('account.storage')
    },
    get webNote() {
      return message('account.webNote')
    },
    get differentEmail() {
      return message('account.differentEmail')
    },
    get deviceProgress() {
      return message('account.deviceProgress')
    },
    get heroTitle() {
      return message('account.heroTitle')
    },
    get heroBody() {
      return message('account.heroBody')
    },
    get emailMethod() {
      return message('account.emailMethod')
    },
    get emailTitle() {
      return message('account.emailTitle')
    },
    get emailBody() {
      return message('account.emailBody')
    },
    get codeTitle() {
      return message('account.codeTitle')
    },
    codeSentTo: (email: string): string => message('account.codeSentTo', { email }),
    get codePlaceholder() {
      return message('account.codePlaceholder')
    },
    get codeHint() {
      return message('account.codeHint')
    },
    get resend() {
      return message('account.resend')
    },
    get codeResent() {
      return message('account.codeResent')
    },
    get backToOptions() {
      return message('account.backToOptions')
    },
    get keepPractising() {
      return message('account.keepPractising')
    },
    get backToPractice() {
      return message('account.backToPractice')
    },
    get confirmationTitle() {
      return message('account.confirmationTitle')
    },
    get confirmationBody() {
      return message('account.confirmationBody')
    },
    get signInOptions() {
      return message('account.signInOptions')
    },
    get emailBack() {
      return message('account.emailBack')
    },
    get cancelSignIn() {
      return message('account.cancelSignIn')
    },
    get secureWindow() {
      return message('account.secureWindow')
    },
    connecting: (provider: string): string => message('account.connecting', { provider }),
    get discoveryError() {
      return message('account.discoveryError')
    },
    get methodUnavailable() {
      return message('account.methodUnavailable')
    },
  },
  audioSpeech: {
    get hear() {
      return message('audioSpeech.hear')
    },
    get stop() {
      return message('audioSpeech.stop')
    },
    get play() {
      return message('audioSpeech.play')
    },
    get tts() {
      return message('audioSpeech.tts')
    },
    get unavailable() {
      return message('audioSpeech.unavailable')
    },
    get error() {
      return message('audioSpeech.error')
    },
    get loading() {
      return message('audioSpeech.loading')
    },
    get playing() {
      return message('audioSpeech.playing')
    },
    get speakTitle() {
      return message('audioSpeech.speakTitle')
    },
    get speakIntro() {
      return message('audioSpeech.speakIntro')
    },
    get privacy() {
      return message('audioSpeech.privacy')
    },
    get revealMode() {
      return message('audioSpeech.revealMode')
    },
    get reveal() {
      return message('audioSpeech.reveal')
    },
    get listen() {
      return message('audioSpeech.listen')
    },
    get listening() {
      return message('audioSpeech.listening')
    },
    get stopListening() {
      return message('audioSpeech.stopListening')
    },
    get heardNothing() {
      return message('audioSpeech.heardNothing')
    },
    get retry() {
      return message('audioSpeech.retry')
    },
    get revealedDone() {
      return message('audioSpeech.revealedDone')
    },
    get spokenDone() {
      return message('audioSpeech.spokenDone')
    },
    get next() {
      return message('audioSpeech.next')
    },
    get skip() {
      return message('audioSpeech.skip')
    },
    get practiceSpeak() {
      return message('audioSpeech.practiceSpeak')
    },
    wordProgress: (revealed: number, total: number): string =>
      message('audioSpeech.wordProgress', { revealed, total }),
    get hiddenWord() {
      return message('audioSpeech.hiddenWord')
    },
    get saveError() {
      return message('audioSpeech.saveError')
    },
  },
  languages: {
    get title() {
      return message('languages.title')
    },
    get native() {
      return message('languages.native')
    },
    get target() {
      return message('languages.target')
    },
    get save() {
      return message('languages.save')
    },
    get invalid() {
      return message('languages.invalid')
    },
    get review() {
      return message('languages.review')
    },
    personalMeaning: (language: string): string =>
      message('languages.personalMeaning', { language }),
  },
  common: {
    get addPhrases() {
      return message('common.addPhrases')
    },
    get stream() {
      return message('common.stream')
    },
    get progress() {
      return message('common.progress')
    },
    get markLearned() {
      return message('common.markLearned')
    },
    get learnedBadge() {
      return message('common.learnedBadge')
    },
    get repsToday() {
      return message('common.repsToday')
    },
    get difficultyQuestion() {
      return message('common.difficultyQuestion')
    },
    selectedSuffix: ' ✓',
    noValue: '—',
    flame: '🔥',
    marks: {
      check: '✓',
      dot: '●',
      ring: '○',
      reveal: '⌄',
    },
    hearts: {
      filled: '♥',
      outline: '♡',
    },
    chevron: {
      left: '‹',
      right: '›',
    },
  },
  difficulty: {
    get easy() {
      return message('difficulty.easy')
    },
    get med() {
      return message('difficulty.med')
    },
    get hard() {
      return message('difficulty.hard')
    },
  },
  tags: {
    get pron() {
      return message('tags.pron')
    },
    get remember() {
      return message('tags.remember')
    },
    get useful() {
      return message('tags.useful')
    },
    get words() {
      return message('tags.words')
    },
  },
  mastery: {
    get new() {
      return message('mastery.new')
    },
    get learning() {
      return message('mastery.learning')
    },
    get strong() {
      return message('mastery.strong')
    },
    get mastered() {
      return message('mastery.mastered')
    },
  },
  nav: {
    get more() {
      return message('nav.more')
    },
    get home() {
      return message('nav.home')
    },
    get phrasePlace() {
      return message('nav.phrasePlace')
    },
    moreGroups: {
      get lately() {
        return message('nav.moreGroups.lately')
      },
      get phrases() {
        return message('nav.moreGroups.phrases')
      },
      get practice() {
        return message('nav.moreGroups.practice')
      },
      get you() {
        return message('nav.moreGroups.you')
      },
    },
    get add() {
      return message('nav.add')
    },
    phrase: '',
    get refrain() {
      return message('nav.refrain')
    },
    get stream() {
      return message('nav.stream')
    },
    get progress() {
      return message('nav.progress')
    },
  },
  today: {
    get title() {
      return message('today.title')
    },
    setHeading: (count: number): string => message('today.setHeading', { count }),
    lockedIn: (locked: number, total: number): string =>
      message('today.lockedIn', { locked, total }),
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
    },
  },
  add: {
    browseTitle: (theme: string, left: number): string =>
      message('add.browseTitle', { theme, left }),
    inStream: (count: number): string => message('add.inStream', { count }),
    modes: {
      get discover() {
        return message('add.modes.discover')
      },
      get browse() {
        return message('add.modes.browse')
      },
      get import() {
        return message('add.modes.import')
      },
    },
    get searchPlaceholder() {
      return message('add.searchPlaceholder')
    },
    get scenarioLabel() {
      return message('add.scenarioLabel')
    },
    context: {
      matches: (query: string): string => message('add.context.matches', { query }),
      get noMatches() {
        return message('add.context.noMatches')
      },
      forScenario: (scenario: string): string => message('add.context.forScenario', { scenario }),
      moreLike: (theme: string): string => message('add.context.moreLike', { theme }),
      get popular() {
        return message('add.context.popular')
      },
    },
    themes: {
      Café: {
        get label() {
          return message('add.themes.Café.label')
        },
        emoji: '☕',
      },
      Dining: {
        get label() {
          return message('add.themes.Dining.label')
        },
        emoji: '🍽',
      },
      Travel: {
        get label() {
          return message('add.themes.Travel.label')
        },
        emoji: '🚆',
      },
      Directions: {
        get label() {
          return message('add.themes.Directions.label')
        },
        emoji: '🧭',
      },
      Shopping: {
        get label() {
          return message('add.themes.Shopping.label')
        },
        emoji: '🛍',
      },
      'Small talk': {
        get label() {
          return message('add.themes.Small talk.label')
        },
        emoji: '🤝',
      },
      Survival: {
        get label() {
          return message('add.themes.Survival.label')
        },
        emoji: '🆘',
      },
      Hotel: {
        get label() {
          return message('add.themes.Hotel.label')
        },
        emoji: '🏨',
      },
    },
    toAdd: (count: number): string => message('add.toAdd', { count }),
    get allAdded() {
      return message('add.allAdded')
    },
    get backToThemes() {
      return message('add.backToThemes')
    },
    empty: {
      get body() {
        return message('add.empty.body')
      },
      get themeComplete() {
        return message('add.empty.themeComplete')
      },
    },
    addGlyph: '+',
    get tagsQuestion() {
      return message('add.tagsQuestion')
    },
    get tagsHelper() {
      return message('add.tagsHelper')
    },
    get confirm() {
      return message('add.confirm')
    },
    import: {
      get title() {
        return message('add.import.title')
      },
      get help() {
        return message('add.import.help')
      },
      get placeholder() {
        return message('add.import.placeholder')
      },
      get preview() {
        return message('add.import.preview')
      },
      tooLarge: (rows: number, characters: number): string =>
        message('add.import.tooLarge', { rows, characters }),
      tooLong: (characters: number): string => message('add.import.tooLong', { characters }),
      review: (count: number): string => message('add.import.review', { count }),
      get reviewHint() {
        return message('add.import.reviewHint')
      },
      get empty() {
        return message('add.import.empty')
      },
      get targetPlaceholder() {
        return message('add.import.targetPlaceholder')
      },
      get meaningPlaceholder() {
        return message('add.import.meaningPlaceholder')
      },
      get duplicate() {
        return message('add.import.duplicate')
      },
      get invalid() {
        return message('add.import.invalid')
      },
      get saveFailed() {
        return message('add.import.saveFailed')
      },
      add: (count: number): string => message('add.import.add', { count }),
    },
  },
  onboarding: {
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
  },
  phrase: {
    missing: {
      get action() {
        return message('phrase.missing.action')
      },
      get title() {
        return message('phrase.missing.title')
      },
      get body() {
        return message('phrase.missing.body')
      },
    },
    sections: {
      get wordByWord() {
        return message('phrase.sections.wordByWord')
      },
      get tricky() {
        return message('phrase.sections.tricky')
      },
      get inContext() {
        return message('phrase.sections.inContext')
      },
      get memoryHook() {
        return message('phrase.sections.memoryHook')
      },
    },
    get tagsHelper() {
      return message('phrase.tagsHelper')
    },
    get hookHelper() {
      return message('phrase.hookHelper')
    },
    hookGlyph: '💡',
    get tapToChange() {
      return message('phrase.tapToChange')
    },
    hooks: {
      get sayAloud() {
        return message('phrase.hooks.sayAloud')
      },
      tie: (opening: string): string => message('phrase.hooks.tie', { opening }),
      get picture() {
        return message('phrase.hooks.picture')
      },
    },
    status: {
      get learned() {
        return message('phrase.status.learned')
      },
      get learning() {
        return message('phrase.status.learning')
      },
      reps: (reps: number, bucket: string): string =>
        message('phrase.status.reps', { reps, bucket }),
    },
    actions: {
      get remove() {
        return message('phrase.actions.remove')
      },
      get practiceNow() {
        return message('phrase.actions.practiceNow')
      },
    },
  },
  refrain: {
    empty: {
      get title() {
        return message('refrain.empty.title')
      },
      get body() {
        return message('refrain.empty.body')
      },
    },
    modes: {
      echo: {
        get label() {
          return message('refrain.modes.echo.label')
        },
        icon: '🔁',
        get cue() {
          return message('refrain.modes.echo.cue')
        },
      },
      chorus: {
        get label() {
          return message('refrain.modes.chorus.label')
        },
        icon: '🎵',
        get cue() {
          return message('refrain.modes.chorus.cue')
        },
      },
      speed: {
        get label() {
          return message('refrain.modes.speed.label')
        },
        icon: '⚡',
        get cue() {
          return message('refrain.modes.speed.cue')
        },
      },
      cloze: {
        get label() {
          return message('refrain.modes.cloze.label')
        },
        icon: '◻️',
        get cue() {
          return message('refrain.modes.cloze.cue')
        },
      },
      call: {
        get label() {
          return message('refrain.modes.call.label')
        },
        icon: '💬',
        get cue() {
          return message('refrain.modes.call.cue')
        },
      },
      cold: {
        get label() {
          return message('refrain.modes.cold.label')
        },
        icon: '❄️',
        get cue() {
          return message('refrain.modes.cold.cue')
        },
      },
    },
    mic: {
      get echo() {
        return message('refrain.mic.echo')
      },
      get chorus() {
        return message('refrain.mic.chorus')
      },
      get speed() {
        return message('refrain.mic.speed')
      },
      get cloze() {
        return message('refrain.mic.cloze')
      },
      get call() {
        return message('refrain.mic.call')
      },
      get cold() {
        return message('refrain.mic.cold')
      },
    },
    phraseCounter: (n: number, total: number): string =>
      message('refrain.phraseCounter', { n, total }),
    prompt: {
      get callLabel() {
        return message('refrain.prompt.callLabel')
      },
      get coldLabel() {
        return message('refrain.prompt.coldLabel')
      },
      clozeBlank: '___',
    },
    automaticity: {
      get label() {
        return message('refrain.automaticity.label')
      },
      percent: (pct: number): string => message('refrain.automaticity.percent', { pct }),
    },
    get effortLabel() {
      return message('refrain.effortLabel')
    },
    effort: {
      get ready() {
        return message('refrain.effort.ready')
      },
      get cold() {
        return message('refrain.effort.cold')
      },
      get warm() {
        return message('refrain.effort.warm')
      },
      get hot() {
        return message('refrain.effort.hot')
      },
      get peak() {
        return message('refrain.effort.peak')
      },
    },
    repCounter: (rep: number, target: number): string =>
      message('refrain.repCounter', { rep, target }),
    get audioNote() {
      return message('refrain.audioNote')
    },
    locked: {
      gem: '💎',
      get title() {
        return message('refrain.locked.title')
      },
      get body() {
        return message('refrain.locked.body')
      },
      get next() {
        return message('refrain.locked.next')
      },
      get finish() {
        return message('refrain.locked.finish')
      },
    },
    done: {
      get headline() {
        return message('refrain.done.headline')
      },
      get title() {
        return message('refrain.done.title')
      },
      get workedLabel() {
        return message('refrain.done.workedLabel')
      },
      get cta() {
        return message('refrain.done.cta')
      },
    },
  },
  stream: {
    empty: {
      get title() {
        return message('stream.empty.title')
      },
      get body() {
        return message('stream.empty.body')
      },
      get action() {
        return message('common.addPhrases')
      },
    },
    counter: (n: number, total: number): string => message('stream.counter', { n, total }),
    get repeatLabel() {
      return message('stream.repeatLabel')
    },
    controls: {
      prev: '◄◄',
      play: '►',
      get next() {
        return message('stream.controls.next')
      },
      skip: '►►',
    },
    get rateQuestion() {
      return message('stream.rateQuestion')
    },
    get lovedBadge() {
      return message('stream.lovedBadge')
    },
    get loveLabel() {
      return message('stream.loveLabel')
    },
    get upNext() {
      return message('stream.upNext')
    },
    pills: {
      loved: (count: number): string => message('stream.pills.loved', { count }),
      hard: (count: number): string => message('stream.pills.hard', { count }),
      learned: (count: number): string => message('stream.pills.learned', { count }),
    },
    get audioNote() {
      return message('stream.audioNote')
    },
  },
  progress: {
    streak: {
      get label() {
        return message('progress.streak.label')
      },
      get empty() {
        return message('progress.streak.empty')
      },
      days: (streak: number): string => message('progress.streak.days', { streak }),
    },
    stats: {
      get phrasesInStream() {
        return message('progress.stats.phrasesInStream')
      },
      get repsDone() {
        return message('progress.stats.repsDone')
      },
      get mastered() {
        return message('progress.stats.mastered')
      },
    },
    mastery: {
      get title() {
        return message('progress.mastery.title')
      },
      total: (count: number): string => message('progress.mastery.total', { count }),
      chartSummary: (buckets: readonly { count: number; label: string }[]): string =>
        formatBuckets(buckets),
    },
    tricky: {
      get title() {
        return message('progress.tricky.title')
      },
      get empty() {
        return message('progress.tricky.empty')
      },
    },
    milestones: {
      get title() {
        return message('progress.milestones.title')
      },
      first10: {
        emoji: '🌱',
        get title() {
          return message('progress.milestones.first10.title')
        },
        sub: (collected: number): string =>
          message('progress.milestones.first10.sub', { collected }),
      },
      firstTag: {
        emoji: '💬',
        get title() {
          return message('progress.milestones.firstTag.title')
        },
        get sub() {
          return message('progress.milestones.firstTag.sub')
        },
      },
      firstLockIn: {
        emoji: '🔥',
        get title() {
          return message('progress.milestones.firstLockIn.title')
        },
        get sub() {
          return message('progress.milestones.firstLockIn.sub')
        },
      },
      mastered25: {
        emoji: '🏆',
        get title() {
          return message('progress.milestones.mastered25.title')
        },
        sub: (mastered: number): string =>
          message('progress.milestones.mastered25.sub', { mastered }),
      },
    },
  },
  toast: {
    get removed() {
      return message('toast.removed')
    },
    get undo() {
      return message('toast.undo')
    },
    get added() {
      return message('toast.added')
    },
    get addedOwn() {
      return message('toast.addedOwn')
    },
    difficulty: {
      get hard() {
        return message('toast.difficulty.hard')
      },
      get easy() {
        return message('toast.difficulty.easy')
      },
      get med() {
        return message('toast.difficulty.med')
      },
    },
    loved: {
      get added() {
        return message('toast.loved.added')
      },
      get removed() {
        return message('toast.loved.removed')
      },
    },
    learned: {
      get marked() {
        return message('toast.learned.marked')
      },
      get unmarked() {
        return message('toast.learned.unmarked')
      },
    },
    drilling: (count: number, label: string): string =>
      message('toast.drilling', { count, label: label.toLocaleLowerCase(currentNativeLanguage()) }),
  },
  a11y: {
    common: {
      get back() {
        return message('a11y.common.back')
      },
      get dismiss() {
        return message('a11y.common.dismiss')
      },
      get undo() {
        return message('a11y.common.undo')
      },
      get removeFromLoved() {
        return message('a11y.common.removeFromLoved')
      },
      get opensPhraseDetails() {
        return message('a11y.common.opensPhraseDetails')
      },
    },
    today: {
      phraseRow: (es: string, pct: number, day: number, days: number): string =>
        message('a11y.today.phraseRow', { es, pct, day, days }),
      startHint: (phrases: number, repsEach: number): string =>
        message('a11y.today.startHint', { phrases, repsEach }),
      place: (place: string): string => message('a11y.today.place', { place }),
      railCount: (label: string, phrases: number): string =>
        message('a11y.today.railCount', { label, phrases }),
      nextWaveRow: (title: string, detail: string): string =>
        message('a11y.today.nextWaveRow', { title, detail }),
      banked: (count: number): string => message('a11y.today.banked', { count }),
      hereNow: (place: string): string => message('a11y.today.hereNow', { place }),
    },
    add: {
      get searchInput() {
        return message('a11y.add.searchInput')
      },
      get importInput() {
        return message('a11y.add.importInput')
      },
      importTarget: (line: number): string => message('a11y.add.importTarget', { line }),
      importMeaning: (line: number): string => message('a11y.add.importMeaning', { line }),
      themeTile: (theme: string, remaining: string): string =>
        message('a11y.add.themeTile', { theme, remaining }),
      get backToThemes() {
        return message('a11y.add.backToThemes')
      },
      suggestionRow: (es: string, en: string): string =>
        message('a11y.add.suggestionRow', { es, en }),
      get opensSheet() {
        return message('a11y.add.opensSheet')
      },
    },
    onboarding: {
      goalValue: (goal: string): string => message('onboarding.goalValue', { goal }),
      option: (label: string, sub: string): string =>
        message('a11y.onboarding.option', { label, sub }),
    },
    phrase: {
      get markLoved() {
        return message('a11y.phrase.markLoved')
      },
      get markStillLearning() {
        return message('a11y.phrase.markStillLearning')
      },
      currentHook: (note: string): string => message('a11y.phrase.currentHook', { note }),
      useHook: (hook: string): string => message('a11y.phrase.useHook', { hook }),
    },
    refrain: {
      card: (cue: string, es: string, pct: number): string =>
        message('a11y.refrain.card', { cue, es, pct }),
    },
    stream: {
      get previous() {
        return message('a11y.stream.previous')
      },
      get next() {
        return message('a11y.stream.next')
      },
      get skip() {
        return message('a11y.stream.skip')
      },
      get loveThisPhrase() {
        return message('a11y.stream.loveThisPhrase')
      },
      queueRow: (es: string, en: string, difficulty: string): string =>
        message('a11y.stream.queueRow', { es, en, difficulty }),
    },
    progress: {
      weekSummary: (practisedDays: number): string =>
        message('a11y.progress.weekSummary', { practisedDays }),
      trickyRow: (label: string, count: number): string =>
        message('a11y.progress.trickyRow', { label, count }),
      get trickyHint() {
        return message('a11y.progress.trickyHint')
      },
    },
  },
}

export function themeLabel(theme: string): string {
  const themes: Record<string, { label: string }> = copy.add.themes
  return themes[theme]?.label ?? message('theme.own', { theme })
}
