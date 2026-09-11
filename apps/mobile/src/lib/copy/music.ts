import { message } from '../i18n'
export const musicCopy = {
  get title() {
    return message('music.title')
  },
  get intro() {
    return message('music.intro')
  },
  picker: {
    get heading() {
      return message('music.picker.heading')
    },
    get hint() {
      return message('music.picker.hint')
    },
    get useToday() {
      return message('music.picker.useToday')
    },
    count: (count: number): string => message('music.picker.count', { count }),
    get needMore() {
      return message('music.picker.needMore')
    },
    get tooMany() {
      return message('music.picker.tooMany')
    },
    phrase: (target: string, translation: string): string =>
      message('music.picker.phrase', { target, translation }),
  },
  lyrics: {
    get request() {
      return message('music.lyrics.request')
    },
    get review() {
      return message('music.lyrics.review')
    },
    get regenerate() {
      return message('music.lyrics.regenerate')
    },
    get confirm() {
      return message('music.lyrics.confirm')
    },
    section: (name: 'Verse 1' | 'Verse 2' | 'Verse 3' | 'Chorus' | 'Bridge' | 'Outro'): string => {
      const keys = {
        'Verse 1': 'music.sections.verse1',
        'Verse 2': 'music.sections.verse2',
        'Verse 3': 'music.sections.verse3',
        Chorus: 'music.sections.chorus',
        Bridge: 'music.sections.bridge',
        Outro: 'music.sections.outro',
      } as const
      return message(keys[name])
    },
  },
  styles: {
    get heading() {
      return message('music.styles.heading')
    },
    get hint() {
      return message('music.styles.hint')
    },
    get confirm() {
      return message('music.styles.confirm')
    },
    get allowance() {
      return message('music.styles.allowance')
    },
    get acoustic_folk() {
      return message('music.styles.acoustic_folk')
    },
    get modern_pop() {
      return message('music.styles.modern_pop')
    },
    get gentle_ballad() {
      return message('music.styles.gentle_ballad')
    },
    get upbeat_kids() {
      return message('music.styles.upbeat_kids')
    },
  },
  state: {
    get generating() {
      return message('music.state.generating')
    },
    get unavailable() {
      return message('music.state.unavailable')
    },
    get quota() {
      return message('music.state.quota')
    },
    get error() {
      return message('music.state.error')
    },
    get partial() {
      return message('music.state.partial')
    },
  },
  fallback: {
    get lyricsOnly() {
      return message('music.fallback.lyricsOnly')
    },
  },
  get play() {
    return message('music.play')
  },
  get pause() {
    return message('music.pause')
  },
  get generated() {
    return message('music.generated')
  },
  duration: (ms: number): string => message('music.duration', { ms }),
}
