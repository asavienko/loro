import { message } from '../i18n'
export const refrainCopy = {
  empty: {
    get title() {
      return message('refrain.empty.title')
    },
    get body() {
      return message('refrain.empty.body')
    },
    hard: {
      get title() {
        return message('refrain.empty.hard.title')
      },
      get body() {
        return message('refrain.empty.hard.body')
      },
    },
    phrase: {
      get title() {
        return message('refrain.empty.phrase.title')
      },
      get body() {
        return message('refrain.empty.phrase.body')
      },
    },
  },
  unavailable: {
    title: (time: string): string => message('refrain.unavailable.title', { time }),
    get complete() {
      return message('refrain.unavailable.complete')
    },
    get body() {
      return message('refrain.unavailable.body')
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
}
