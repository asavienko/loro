import { message } from '../i18n'
export const listenExportCopy = {
  get title() {
    return message('listenExport.title')
  },
  get intro() {
    return message('listenExport.intro')
  },
  phraseCount: (count: number): string => message('listenExport.phraseCount', { count }),
  get repeats() {
    return message('listenExport.repeats')
  },
  repeatValue: (count: number): string => message('listenExport.repeatValue', { count }),
  get decreaseRepeats() {
    return message('listenExport.decreaseRepeats')
  },
  get increaseRepeats() {
    return message('listenExport.increaseRepeats')
  },
  get voices() {
    return message('listenExport.voices')
  },
  get voicesEmpty() {
    return message('listenExport.voicesEmpty')
  },
  sequence: (sequence: string): string => message('listenExport.sequence', { sequence }),
  get generate() {
    return message('listenExport.generate')
  },
  get cancel() {
    return message('listenExport.cancel')
  },
  get resume() {
    return message('listenExport.resume')
  },
  get listen() {
    return message('listenExport.listen')
  },
  get stop() {
    return message('listenExport.stop')
  },
  get share() {
    return message('listenExport.share')
  },
  get consent() {
    return message('listenExport.consent')
  },
  get consentDetail() {
    return message('listenExport.consentDetail')
  },
  get deviceFallback() {
    return message('listenExport.deviceFallback')
  },
  durationMeasured: (ms: number): string => message('listenExport.durationMeasured', { ms }),
  get durationUnknown() {
    return message('listenExport.durationUnknown')
  },
  progress: (done: number, total: number): string =>
    message('listenExport.progress', { done, total }),
  get fixtureNote() {
    return message('listenExport.fixtureNote')
  },
  status: {
    get empty() {
      return message('listenExport.status.empty')
    },
    get 'needs-network'() {
      return message('listenExport.status.needs-network')
    },
    get generating() {
      return message('listenExport.status.generating')
    },
    get 'partial-failure'() {
      return message('listenExport.status.partial-failure')
    },
    get 'ready-to-listen'() {
      return message('listenExport.status.ready-to-listen')
    },
    get 'ready-to-generate'() {
      return message('listenExport.status.ready-to-generate')
    },
    get playing() {
      return message('listenExport.status.playing')
    },
    get 'share-unavailable'() {
      return message('listenExport.status.share-unavailable')
    },
    get 'share-ready'() {
      return message('listenExport.status.share-ready')
    },
    get cancelled() {
      return message('listenExport.status.cancelled')
    },
    get 'disk-full'() {
      return message('listenExport.status.disk-full')
    },
    get 'session-busy'() {
      return message('listenExport.status.session-busy')
    },
    get 'voices-unapproved'() {
      return message('listenExport.status.voices-unapproved')
    },
    get 'not-configured'() {
      return message('listenExport.status.not-configured')
    },
    get 'native-unavailable'() {
      return message('listenExport.status.native-unavailable')
    },
    get 'model-unpinned'() {
      return message('listenExport.status.model-unpinned')
    },
    get 'voices-single'() {
      return message('listenExport.status.voices-single')
    },
    get quota() {
      return message('listenExport.status.quota')
    },
    get 'fixture-generating'() {
      return message('listenExport.status.fixture-generating')
    },
  },
}
