import { message } from '../i18n'
import { cadenceRateLabel } from '../streamCadence'
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
  get lovedBadge() {
    return message('stream.lovedBadge')
  },
  get loveLabel() {
    return message('stream.loveLabel')
  },
  upNext: (count: number): string => message('stream.upNext', { count }),
  get playingFromPlaylist() {
    return message('stream.playingFromPlaylist')
  },
  pills: {
    loved: (count: number): string => message('stream.pills.loved', { count }),
    hard: (count: number): string => message('stream.pills.hard', { count }),
    learned: (count: number): string => message('stream.pills.learned', { count }),
  },
  get audioNote() {
    return message('stream.audioNote')
  },
  quotedTranslation: (text: string): string => message('stream.quotedTranslation', { text }),
  queue: {
    get title() {
      return message('stream.queue.title')
    },
    kicker: (count: number): string => message('stream.queue.kicker', { count }),
    earlier: (count: number): string => message('stream.queue.earlier', { count }),
    get hide() {
      return message('stream.queue.hide')
    },
    get show() {
      return message('stream.queue.show')
    },
    get nowPlaying() {
      return message('stream.queue.nowPlaying')
    },
    get target() {
      return message('stream.queue.target')
    },
    nowPlayingTrack: (track: string): string => message('stream.queue.nowPlayingTrack', { track }),
    get done() {
      return message('stream.queue.done')
    },
  },
  cadence: {
    loop: (count: number): string => message('stream.cadence.loop', { count }),
    rate: (rate: number): string => message('stream.cadence.rate', { label: cadenceRateLabel(rate) }),
  },
  drill: {
    get title() {
      return message('stream.drill.title')
    },
    get hide() {
      return message('stream.drill.hide')
    },
    get show() {
      return message('stream.drill.show')
    },
  },
  stage: {
    get mnemonic() {
      return message('stream.stage.mnemonic')
    },
    get phonetics() {
      return message('stream.stage.phonetics')
    },
    get grammar() {
      return message('stream.stage.grammar')
    },
    get grammarEmpty() {
      return message('stream.stage.grammarEmpty')
    },
    get mnemonicEmpty() {
      return message('stream.stage.mnemonicEmpty')
    },
    get phoneticsEmpty() {
      return message('stream.stage.phoneticsEmpty')
    },
  },
}
