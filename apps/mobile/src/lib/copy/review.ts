import { message } from '../i18n'

export const reviewCopy = {
  get title() {
    return message('review.title')
  },
  emptyCourse: {
    get title() {
      return message('review.emptyCourse.title')
    },
    get body() {
      return message('review.emptyCourse.body')
    },
  },
  noSchedule: {
    get title() {
      return message('review.noSchedule.title')
    },
    get body() {
      return message('review.noSchedule.body')
    },
  },
  nothingDue: {
    get title() {
      return message('review.nothingDue.title')
    },
    get body() {
      return message('review.nothingDue.body')
    },
  },
  due: {
    count: (count: number): string => message('review.due.count', { count }),
    get body() {
      return message('review.due.body')
    },
    get waiting() {
      return message('review.due.waiting')
    },
    get resume() {
      return message('review.due.resume')
    },
  },
  grade: {
    get again() {
      return message('review.grade.again')
    },
    get hard() {
      return message('review.grade.hard')
    },
    get good() {
      return message('review.grade.good')
    },
    get easy() {
      return message('review.grade.easy')
    },
  },
  get prompt() {
    return message('review.prompt')
  },
  get reveal() {
    return message('review.reveal')
  },
  get howWell() {
    return message('review.howWell')
  },
  progress: (current: number, total: number): string =>
    message('review.progress', { current, total }),
  focus: {
    get recall() {
      return message('review.focus.recall')
    },
    get pronunciation() {
      return message('review.focus.pronunciation')
    },
    get remember() {
      return message('review.focus.remember')
    },
    get useful() {
      return message('review.focus.useful')
    },
  },
  get badge() {
    return message('review.badge')
  },
  get mode() {
    return message('review.mode')
  },
  get playDeck() {
    return message('review.playDeck')
  },
  get stopDeck() {
    return message('review.stopDeck')
  },
  deck: {
    get title() {
      return message('review.deck.title')
    },
    get badge() {
      return message('review.deck.badge')
    },
  },
  get nowRepeating() {
    return message('review.nowRepeating')
  },
  syllables: (count: number): string => message('review.syllables', { count }),
  automaticity: (pct: number): string => message('review.automaticity', { pct }),
  tab: {
    get mnemonic() {
      return message('review.tab.mnemonic')
    },
    get grammar() {
      return message('review.tab.grammar')
    },
    get phonetics() {
      return message('review.tab.phonetics')
    },
    get mnemonicEmpty() {
      return message('review.tab.mnemonicEmpty')
    },
    get grammarEmpty() {
      return message('review.tab.grammarEmpty')
    },
    get phoneticsEmpty() {
      return message('review.tab.phoneticsEmpty')
    },
  },
  get addPhrases() {
    return message('common.addPhrases')
  },
}
