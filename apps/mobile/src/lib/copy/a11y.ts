import { message } from '../i18n'
export const a11yCopy = {
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
    get profile() {
      return message('a11y.today.profile')
    },
    get browse() {
      return message('a11y.today.browse')
    },
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
    ownRow: (query: string): string => message('a11y.add.ownRow', { query }),
    suggestedRow: (es: string, en: string): string => message('a11y.add.suggestedRow', { es, en }),
    get sheetTarget() {
      return message('a11y.add.sheetTarget')
    },
    get sheetMeaning() {
      return message('a11y.add.sheetMeaning')
    },
    nearestScenario: (label: string): string => message('a11y.add.nearestScenario', { label }),
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
    replay: (es: string): string => message('a11y.stream.replay', { es }),
    jumpTo: (es: string): string => message('a11y.stream.jumpTo', { es }),
    reorder: (es: string): string => message('a11y.stream.reorder', { es }),
    get reorderHint() {
      return message('a11y.stream.reorderHint')
    },
    loop: (count: number): string => message('a11y.stream.loop', { count }),
    rate: (rate: number): string => message('a11y.stream.rate', { rate }),
    get mnemonic() {
      return message('a11y.stream.mnemonic')
    },
    get phonetics() {
      return message('a11y.stream.phonetics')
    },
    get grammar() {
      return message('a11y.stream.grammar')
    },
    get options() {
      return message('a11y.stream.options')
    },
    get trackOptions() {
      return message('a11y.stream.trackOptions')
    },
    get dismissOptions() {
      return message('a11y.stream.dismissOptions')
    },
    get openNowPlaying() {
      return message('a11y.stream.openNowPlaying')
    },
    get dismissPlayer() {
      return message('a11y.stream.dismissPlayer')
    },
    get doneQueue() {
      return message('a11y.stream.doneQueue')
    },
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
  review: {
    get dock() {
      return message('a11y.review.dock')
    },
    grade: (grade: string, interval: string): string =>
      message('a11y.review.grade', { grade, interval }),
    get cardHidden() {
      return message('a11y.review.cardHidden')
    },
    get cardShown() {
      return message('a11y.review.cardShown')
    },
    get showNotes() {
      return message('a11y.review.showNotes')
    },
    get notesShown() {
      return message('a11y.review.notesShown')
    },
  },
  listenExport: {
    get status() {
      return message('a11y.listenExport.status')
    },
    get repeats() {
      return message('a11y.listenExport.repeats')
    },
  },
}
