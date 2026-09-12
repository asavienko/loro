import { message } from '../i18n'
export const addCopy = {
  browseTitle: (theme: string, left: number): string => message('add.browseTitle', { theme, left }),
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
    moreLike: (phrase: string): string => message('add.context.moreLike', { phrase }),
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
  own: {
    get action() {
      return message('add.own.action')
    },
    get hint() {
      return message('add.own.hint')
    },
  },
  suggested: {
    get title() {
      return message('add.suggested.title')
    },
    get looking() {
      return message('add.suggested.looking')
    },
    get provenance() {
      return message('add.suggested.provenance')
    },
  },
  sheet: {
    get targetPlaceholder() {
      return message('add.sheet.targetPlaceholder')
    },
    get meaningPlaceholder() {
      return message('add.sheet.meaningPlaceholder')
    },
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
    get chooseFile() {
      return message('add.import.chooseFile')
    },
    get unsupportedFormat() {
      return message('add.import.unsupportedFormat')
    },
    get fileTooLarge() {
      return message('add.import.fileTooLarge')
    },
    get unsupportedEncoding() {
      return message('add.import.unsupportedEncoding')
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
}
