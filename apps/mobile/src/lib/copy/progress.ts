import { message, formatBuckets } from '../i18n'
export const progressCopy = {
  streak: {
    get label() {
      return message('progress.streak.label')
    },
    get empty() {
      return message('progress.streak.empty')
    },
    days: (streak: number): string => message('progress.streak.days', { streak }),
  },
  stats: {
    get phrasesInStream() {
      return message('progress.stats.phrasesInStream')
    },
    get repsDone() {
      return message('progress.stats.repsDone')
    },
    get mastered() {
      return message('progress.stats.mastered')
    },
  },
  mastery: {
    get title() {
      return message('progress.mastery.title')
    },
    total: (count: number): string => message('progress.mastery.total', { count }),
    share: (count: number, percent: number): string =>
      message('progress.mastery.share', { count, percent }),
    chartSummary: (buckets: readonly { count: number; label: string }[]): string =>
      formatBuckets(buckets),
  },
  tricky: {
    get title() {
      return message('progress.tricky.title')
    },
    get empty() {
      return message('progress.tricky.empty')
    },
  },
  milestones: {
    get title() {
      return message('progress.milestones.title')
    },
    first10: {
      emoji: '🌱',
      get title() {
        return message('progress.milestones.first10.title')
      },
      sub: (collected: number): string => message('progress.milestones.first10.sub', { collected }),
    },
    firstTag: {
      emoji: '💬',
      get title() {
        return message('progress.milestones.firstTag.title')
      },
      get sub() {
        return message('progress.milestones.firstTag.sub')
      },
    },
    firstLockIn: {
      emoji: '🔥',
      get title() {
        return message('progress.milestones.firstLockIn.title')
      },
      get sub() {
        return message('progress.milestones.firstLockIn.sub')
      },
    },
    mastered25: {
      emoji: '🏆',
      get title() {
        return message('progress.milestones.mastered25.title')
      },
      sub: (mastered: number): string =>
        message('progress.milestones.mastered25.sub', { mastered }),
    },
  },
}
