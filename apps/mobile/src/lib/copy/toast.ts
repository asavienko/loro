import { message, currentNativeLanguage } from '../i18n'
export const toastCopy = {
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
}
