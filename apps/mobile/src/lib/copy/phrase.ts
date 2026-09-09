import { message } from '../i18n'
export const phraseCopy = {
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
    reps: (reps: number, bucket: string): string => message('phrase.status.reps', { reps, bucket }),
  },
  actions: {
    get remove() {
      return message('phrase.actions.remove')
    },
    get practiceNow() {
      return message('phrase.actions.practiceNow')
    },
  },
}
