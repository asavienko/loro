import { message } from '../i18n'
export const streamCopy = {
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
  get thisWave() {
    return message('stream.thisWave')
  },
  get practiceRefrain() {
    return message('stream.practiceRefrain')
  },
  pills: {
    loved: (count: number): string => message('stream.pills.loved', { count }),
    hard: (count: number): string => message('stream.pills.hard', { count }),
    learned: (count: number): string => message('stream.pills.learned', { count }),
  },
  get audioNote() {
    return message('stream.audioNote')
  },
}
