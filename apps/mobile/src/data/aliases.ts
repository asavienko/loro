import { userPhraseId } from '@loro/core'
import type { AppData, CourseState } from '../store/state'
import { readLocalValue, type RuntimeDatabase } from './database'

/** A server may canonicalize two devices' independently-added catalog rows. */
export function resolveLearnerAliases(database: RuntimeDatabase, state: AppData): AppData {
  const saved = readLocalValue(database.driver, 'sync.aliases')
  if (saved === null) return state
  const aliases = JSON.parse(saved) as Record<string, string>
  function resolve(id: string): string {
    const visited = new Set<string>()
    while (aliases[id]) {
      if (visited.has(id)) throw new Error('Cyclic sync phrase alias')
      visited.add(id)
      id = aliases[id] ?? id
    }
    return id
  }
  function course<T extends CourseState>(value: T): T {
    return {
      ...value,
      phrases: value.phrases.map((phrase) =>
        resolve(phrase.id) === phrase.id
          ? phrase
          : { ...phrase, id: userPhraseId(resolve(phrase.id)) },
      ),
      selectedId: value.selectedId === null ? null : resolve(value.selectedId),
      refrainSet: value.refrainSet.map(resolve),
      refrainSubstituted: value.refrainSubstituted.map(resolve),
      refrainResume: {
        ...value.refrainResume,
        session:
          value.refrainResume.session === null
            ? null
            : {
                ...value.refrainResume.session,
                plan: {
                  ...value.refrainResume.session.plan,
                  items: value.refrainResume.session.plan.items.map((item) => ({
                    ...item,
                    phraseId: userPhraseId(resolve(item.phraseId)),
                  })),
                },
              },
      },
    }
  }
  return {
    ...course(state),
    courses: Object.fromEntries(
      Object.entries(state.courses).map(([locale, value]) => [locale, course(value)]),
    ),
  }
}
