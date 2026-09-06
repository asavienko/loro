/** F-08: join course-scoped learner state to the selected native-language content. */
import type { PhraseState } from '@loro/core'
import { targetForPhraseId } from '@loro/content'
import { currentNativeLanguage } from '../lib/i18n'
import { displayPhrase, type DisplayPhrase } from './learningCatalog'
import { OWN_PHRASE_FALLBACK } from './phraseFactory'

export interface PhraseView extends PhraseState {
  targetText: string
  translation: string
  meaningLanguage: string
  theme: string
  emoji: string
  catalog: DisplayPhrase | null
}
export function toView(p: PhraseState): PhraseView {
  const native = currentNativeLanguage()
  const target = p.targetLocale ?? targetForPhraseId(p.phraseId ?? '')
  const cat =
    p.phraseId === null
      ? null
      : (displayPhrase(target, native === target.split('-')[0] ? 'en' : native, p.phraseId) ?? null)
  const targetText = cat?.targetText ?? p.ownEs ?? ''
  const translation = cat?.translation ?? p.ownEn ?? ''
  return {
    ...p,
    targetLocale: target,
    targetText,
    translation,
    meaningLanguage: cat ? native : (p.ownMeaningLanguage ?? 'en'),
    theme: cat?.theme ?? p.ownTheme ?? OWN_PHRASE_FALLBACK.theme,
    emoji: cat?.emoji ?? p.ownEmoji ?? OWN_PHRASE_FALLBACK.emoji,
    catalog: cat,
  }
}
