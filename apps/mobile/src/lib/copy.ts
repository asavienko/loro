/** F-08. Reactive readers translate at access time; domain and UI layers share this adapter. */
import { message } from './i18n'
import { persistenceCopy } from './i18n/persistence'
import { accountCopy } from './copy/account'
import { audioSpeechCopy } from './copy/audioSpeech'
import { languagesCopy } from './copy/languages'
import { settingsCopy } from './copy/settings'
import { commonCopy } from './copy/common'
import { difficultyCopy } from './copy/difficulty'
import { tagsCopy } from './copy/tags'
import { masteryCopy } from './copy/mastery'
import { navCopy } from './copy/nav'
import { todayCopy } from './copy/today'
import { addCopy } from './copy/add'
import { onboardingCopy } from './copy/onboarding'
import { phraseCopy } from './copy/phrase'
import { refrainCopy } from './copy/refrain'
import { streamCopy } from './copy/stream'
import { progressCopy } from './copy/progress'
import { toastCopy } from './copy/toast'
import { a11yCopy } from './copy/a11y'

export const copy = {
  persistence: persistenceCopy,
  account: accountCopy,
  audioSpeech: audioSpeechCopy,
  languages: languagesCopy,
  settings: settingsCopy,
  common: commonCopy,
  difficulty: difficultyCopy,
  tags: tagsCopy,
  mastery: masteryCopy,
  nav: navCopy,
  today: todayCopy,
  add: addCopy,
  onboarding: onboardingCopy,
  phrase: phraseCopy,
  refrain: refrainCopy,
  stream: streamCopy,
  progress: progressCopy,
  toast: toastCopy,
  a11y: a11yCopy,
}

export function themeLabel(theme: string): string {
  const themes: Record<string, { label: string }> = copy.add.themes
  return themes[theme]?.label ?? message('theme.own', { theme })
}
