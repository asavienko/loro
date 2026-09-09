import { message } from '../i18n'
export const commonCopy = {
  get addPhrases() {
    return message('common.addPhrases')
  },
  get stream() {
    return message('common.stream')
  },
  get progress() {
    return message('common.progress')
  },
  get markLearned() {
    return message('common.markLearned')
  },
  get learnedBadge() {
    return message('common.learnedBadge')
  },
  get repsToday() {
    return message('common.repsToday')
  },
  get difficultyQuestion() {
    return message('common.difficultyQuestion')
  },
  selectedSuffix: ' ✓',
  noValue: '—',
  flame: '🔥',
  marks: {
    check: '✓',
    dot: '●',
    ring: '○',
    reveal: '⌄',
  },
  hearts: {
    filled: '♥',
    outline: '♡',
  },
  chevron: {
    left: '‹',
    right: '›',
  },
}
