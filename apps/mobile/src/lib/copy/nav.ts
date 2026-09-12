import { message } from '../i18n'
export const navCopy = {
  get more() {
    return message('nav.more')
  },
  get home() {
    return message('nav.home')
  },
  get phrasePlace() {
    return message('nav.phrasePlace')
  },
  ongoing: {
    get heading() {
      return message('nav.ongoing.heading')
    },
    refrain: (rep: number): string => message('nav.ongoing.refrain', { rep }),
    count: (count: number): string => message('nav.ongoing.count', { count }),
  },
  exit: {
    get leave() {
      return message('nav.exit.leave')
    },
    get title() {
      return message('nav.exit.title')
    },
    get titlePractice() {
      return message('nav.exit.titlePractice')
    },
    get pause() {
      return message('nav.exit.pause')
    },
    get pausePractice() {
      return message('nav.exit.pausePractice')
    },
    get end() {
      return message('nav.exit.end')
    },
    get keepGoing() {
      return message('nav.exit.keepGoing')
    },
    get note() {
      return message('nav.exit.note')
    },
    get noteStream() {
      return message('nav.exit.noteStream')
    },
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
  get listenExport() {
    return message('nav.listenExport')
  },
  get music() {
    return message('nav.music')
  },
}
