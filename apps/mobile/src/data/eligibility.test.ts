/**
 * One adversarial row history, read by every implementation there is.
 *
 * The eligibility rule was written four times — SQL `WHERE`, the memory table, the Refrain's
 * candidate filter, and the store's repository adapter — and the fourth disagreed: it
 * required `!learned` but not `graduatedAt === null`, so a graduated phrase stayed in what
 * the engines planned from while every persistence reader already excluded it. That
 * divergence was RECORDED in a comment for a year rather than caught, because no test read
 * two implementations with the same rows.
 *
 * Each row below is a state a real learner reaches, including the combinations: learned AND
 * due, graduated AND due, learned AND graduated, and deleted.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_REP_TARGET, asPhraseRepository, userPhraseId, type PhraseState } from '@loro/core'
import { makePhrase } from '@loro/core/testing'
import { jsCoreFacade } from '../store/coreFacade'
import { createEngineContext } from '../store/engines'
import { createAppStore } from '../store/store'
import { AT, implementations, storeClock } from './persistence.harness'

describe('eligibility agrees across every implementation', () => {
  const overdue = {
    stability: 1,
    difficulty: 5,
    due: AT - 1,
    lastReview: null,
    lapses: 0,
    state: 'review' as const,
  }

  const rows: PhraseState[] = [
    { ...makePhrase('a'), id: userPhraseId('id-plain') },
    { ...makePhrase('b', { learned: true }), id: userPhraseId('id-learned') },
    { ...makePhrase('c'), id: userPhraseId('id-learned-due'), learned: true, srs: overdue },
    { ...makePhrase('d', { graduatedAt: AT }), id: userPhraseId('id-graduated') },
    { ...makePhrase('e', { graduatedAt: AT }), id: userPhraseId('id-graduated-due'), srs: overdue },
    {
      ...makePhrase('f', { learned: true, graduatedAt: AT }),
      id: userPhraseId('id-learned-graduated'),
    },
    { ...makePhrase('g'), id: userPhraseId('id-deleted'), srs: overdue },
  ]
  const deleted = userPhraseId('id-deleted')

  /**
   * `active()` and `due()` from each implementation, as sorted id lists.
   *
   * The store's array is the fourth reader. It has no tombstone: `removePhrase` splices the
   * row out, so the deleted row is modelled by its absence — which is what the running app
   * actually does.
   */
  const readers = (): Record<string, { active: Promise<string[]>; due: Promise<string[]> }> => {
    const ids = (p: Promise<readonly PhraseState[]>): Promise<string[]> =>
      p.then((read) => read.map((r) => r.id).sort())

    const built: Record<string, { active: Promise<string[]>; due: Promise<string[]> }> = {}
    for (const [name, open] of implementations) {
      const db = open()
      for (const row of rows) db.phrases.upsert(row)
      db.phrases.softDelete(deleted, AT)
      const repo = asPhraseRepository(db.phrases)
      built[name] = { active: ids(repo.active()), due: ids(repo.due(AT)) }
    }

    const store = createAppStore({ clock: storeClock, newId: () => userPhraseId('unused') })
    store.setState({ phrases: rows.filter((r) => r.id !== deleted) })
    const storeRepo = createEngineContext(
      store,
      {
        clock: storeClock,
        waveTimes: ['08:00'],
        repTarget: DEFAULT_REP_TARGET,
        trip: null,
        flags: { bool: (_k, d) => d, number: (_k, d) => d },
        seed: 1,
      },
      jsCoreFacade,
    ).phrases
    built['store'] = { active: ids(storeRepo.active()), due: ids(storeRepo.due(AT)) }
    return built
  }

  it('plans only with rows that are neither learned, graduated, nor deleted', async () => {
    for (const [name, reader] of Object.entries(readers())) {
      expect(await reader.active, `${name}.active()`).toEqual(['id-plain'])
    }
  })

  it('still owes a review on a GRADUATED row, but never on a learned or deleted one', async () => {
    // Graduation ends the daily ritual, not the FSRS schedule — so `due` is deliberately
    // NOT `active` plus a date, and every implementation has to make the same distinction.
    for (const [name, reader] of Object.entries(readers())) {
      expect(await reader.due, `${name}.due()`).toEqual(['id-graduated-due'])
    }
  })

  it('cannot let a graduated row back in by upserting it again', () => {
    // `graduatedAt` is monotonic in `applyDelta`, but the repository must not be the way
    // round it either: writing the row again is not an ungraduation.
    for (const [, open] of implementations) {
      const db = open()
      const p = { ...makePhrase('a', { graduatedAt: AT }), id: userPhraseId('id-a') }
      db.phrases.upsert(p)
      db.phrases.upsert({ ...p, reps: 4 })
      expect(db.phrases.active()).toEqual([])
      expect(db.phrases.all()).toHaveLength(1)
    }
  })
})
