/**
 * What the code checks about every candidate before a phrase is accepted (plan 112 §3): the
 * limits, the script, the glosses, the brief's words, the duplicates. The model's claims (`uses`,
 * `grammar`) are compared with the text, never trusted. A failed candidate carries the rule it
 * broke, so a repair call can say exactly what went wrong.
 */
import { fold, type AuthoringContext, type KnownPhrase } from './context.js'
import type { RawCandidate } from './prompt/phrases.js'
import { MAX_CHARS, MAX_WORDS, type Slot } from './slot.js'

export interface Checked {
  candidate: RawCandidate
  /** Positions in the answer, for a stable tie-break. */
  index: number
  problems: string[]
  /** The must-use lemmas the text really contains. */
  uses: string[]
  /** The brief's grammar ids the model claims, limited to known ones. */
  grammar: string[]
  icons: string[]
  score: number
}

export const JACCARD_NEAR = 0.8

export function tokens(text: string): string[] {
  return fold(text)
    .split(' ')
    .filter((t) => t.length > 0)
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a)
  const sb = new Set(b)
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared += 1
  const union = sa.size + sb.size - shared
  return union === 0 ? 1 : shared / union
}

const SCRIPT_RE = {
  Latin: /^[\p{Script=Latin}\p{P}\p{N}\p{Zs}¿¡€]+$/u,
  Cyrillic: /^[\p{Script=Cyrillic}\p{P}\p{N}\p{Zs}]+$/u,
} as const

export function scriptOf(course: Slot['course']): keyof typeof SCRIPT_RE {
  return course === 'bg-BG' || course === 'ru-RU' ? 'Cyrillic' : 'Latin'
}

const INFINITIVE = /^(.+?)(ar|er|ir)(se)?$/

/**
 * The stems a verb's forms may start with: the infinitive without its ending, and the same with
 * the common stem changes (e→ie, o→ue, e→i), so «querer» finds «quiero» and «poder» «puede».
 */
export function verbStems(lemma: string): string[] {
  const m = INFINITIVE.exec(lemma)
  if (!m?.[1] || m[1].length < 3) return []
  const stem = m[1]
  const last = (vowel: string) => stem.lastIndexOf(vowel)
  const swap = (at: number, to: string) => `${stem.slice(0, at)}${to}${stem.slice(at + 1)}`
  const out = new Set([stem])
  if (last('e') >= 0) {
    out.add(swap(last('e'), 'ie'))
    out.add(swap(last('e'), 'i'))
  }
  if (last('o') >= 0) out.add(swap(last('o'), 'ue'))
  return [...out]
}

/** Polish verb endings, folded (ć → c), longest first; «-ować» verbs conjugate on «-uj-». */
const POLISH_VERB = /^(.+?)(owac|iec|ac|ec|ic|yc|uc|c)(\s+sie)?$/

/**
 * The stems a Polish word's forms may start with, folded: a verb without its infinitive ending
 * («płacić» finds «płacę», «kosztować» «kosztuje»), a noun or adjective without its final vowel
 * («kawa» finds «kawę», «zimny» «zimną»), a fleeting e dropped («rachunek» finds «rachunku»), and
 * a stem's softening «i» dropped («chcieć» finds «chcę»). Folding already joins ś/s, ć/c, ż/z, ó/o
 * and ę/e, and a prefix match covers s → sz and c → cz. Rough on purpose, as for Spanish.
 */
export function polishStems(lemma: string, pos?: string): string[] {
  const word = fold(lemma)
  const out = new Set<string>()
  const verb = pos === 'verb' ? POLISH_VERB.exec(word) : null
  if (verb?.[1]) {
    out.add(verb[1])
    if (verb[2] === 'owac') out.add(`${verb[1]}uj`)
  } else {
    out.add(word)
    const vowel = /^(.+?)[aeiouy]$/.exec(word)
    if (vowel?.[1]) out.add(vowel[1])
    const fleeting = /^(.+)e([kcn])$/.exec(word)
    if (fleeting?.[1] && fleeting[2]) out.add(`${fleeting[1]}${fleeting[2]}`)
  }
  for (const stem of [...out]) if (stem.length > 3 && stem.endsWith('i')) out.add(stem.slice(0, -1))
  return [...out].filter((stem) => stem.length >= 3 || stem === word)
}

function polishWordMatches(word: string, part: string, pos?: string): boolean {
  if (word === part) return true
  if (part.length < 3) return false
  return polishStems(part, pos).some((stem) => word.startsWith(stem))
}

/**
 * Whether a lemma is in the text: a multi-word unit as a run of words; a verb (an infinitive by
 * its ending, or by `pos`) by a stem at the start of a word; any other word of four letters or
 * more as a prefix, so «tostada» finds «tostadas». Polish matches each word by its stems, since
 * its cases change endings. Rough on purpose; the lemmatizer stage replaces it (plan 112 §3).
 */
export function containsLemma(
  text: string,
  lemma: string,
  pos?: string,
  course?: Slot['course'],
): boolean {
  const words = tokens(text)
  const parts = tokens(lemma)
  if (parts.length === 0) return false
  if (course === 'pl-PL') {
    // An infinitive is known by its «ć» before folding, when no part of speech is given.
    const partPos =
      parts.length > 1 ? undefined : (pos ?? (lemma.trim().endsWith('ć') ? 'verb' : undefined))
    return words.some((_, start) =>
      parts.every((part, i) => {
        const w = words[start + i]
        return w !== undefined && polishWordMatches(w, part, partPos)
      }),
    )
  }
  if (parts.length > 1) return ` ${words.join(' ')} `.includes(` ${parts.join(' ')} `)
  const [one] = parts
  if (one === undefined) return false
  const stems = pos === 'verb' || (pos === undefined && INFINITIVE.test(one)) ? verbStems(one) : []
  if (stems.length > 0) return words.some((w) => stems.some((s) => w.startsWith(s)))
  return words.some((w) => w === one || (one.length >= 4 && w.startsWith(one)))
}

export function checkCandidate(
  slot: Slot,
  candidate: RawCandidate,
  index: number,
  context: AuthoringContext,
  siblings: readonly KnownPhrase[],
): Checked {
  const problems: string[] = []
  const target = candidate.target.trim()
  const words = tokens(target)
  const max = MAX_WORDS[slot.level]
  if (words.length === 0) problems.push('empty')
  if (words.length > max)
    problems.push(`${words.length} words, the limit at ${slot.level} is ${max}`)
  if (target.length > MAX_CHARS)
    problems.push(`${target.length} characters, the limit is ${MAX_CHARS}`)
  const script = scriptOf(slot.course)
  if (!SCRIPT_RE[script].test(target)) problems.push(`not only ${script} script`)
  if (/\d/.test(target)) problems.push('digits in the phrase')
  if (!candidate.en_GB.trim() || !candidate.en_US.trim()) problems.push('missing English')

  // Glosses: every word of the target is covered, in order, by the `words` entries.
  const glossed = candidate.words.map((w) => tokens(w.w).join(' ')).filter((w) => w.length > 0)
  const joined = ` ${glossed.join(' ')} `
  const targetJoined = ` ${words.join(' ')} `
  if (joined !== targetJoined) {
    problems.push(
      `\`words\` must list every word of the target in order (got: ${glossed.join(' | ')})`,
    )
  }
  if (candidate.words.some((w) => !w.gloss_en.trim())) problems.push('an empty gloss')

  // The brief's words: what the text really contains, and nothing banned.
  const mustUse = slot.brief.mustUse.map((l) => l.lemma)
  const uses = slot.brief.mustUse
    .filter((l) => containsLemma(target, l.lemma, l.pos, slot.course))
    .map((l) => l.lemma)
  const claimedButAbsent = candidate.uses.filter((u) => mustUse.includes(u) && !uses.includes(u))
  if (claimedButAbsent.length > 0)
    problems.push(`claims to use ${claimedButAbsent.join(', ')} but does not`)
  const banned = slot.brief.avoid.lemmas.filter((lemma) =>
    containsLemma(target, lemma, undefined, slot.course),
  )
  if (banned.length > 0) problems.push(`uses banned word(s): ${banned.join(', ')}`)

  // Duplicates: the course and the bank, then the siblings.
  const key = fold(target)
  const existing = context.textKeys.get(key)
  if (existing !== undefined) problems.push(`already in the course as ${existing}`)
  for (const sibling of siblings) {
    if (jaccard(words, tokens(sibling.target)) >= JACCARD_NEAR) {
      problems.push(`too close to «${sibling.target}»`)
      break
    }
  }

  const knownGrammar = slot.brief.grammarFocus.map((g) => g.id)
  const grammar = candidate.grammar.filter((g) => knownGrammar.includes(g))
  const icons = [...new Set(candidate.icons)].filter((i) => context.icons.includes(i)).slice(0, 3)
  if (icons.length === 0) problems.push('no known icon')

  const score = uses.length * 3 + (grammar.length > 0 ? 2 : 0) + (target.includes('?') ? 1 : 0)
  return { candidate: { ...candidate, target }, index, problems, uses, grammar, icons, score }
}

export interface Selection {
  chosen: Checked[]
  rejected: Checked[]
  /** Must-use lemmas no chosen phrase contains. */
  missing: string[]
  /** Share of the brief's must-use words covered by the chosen phrases. */
  coverage: number
}

export const MIN_COVERAGE = 0.8

/**
 * The best `count` passing candidates by score, then by position; a candidate too close to one
 * already chosen is dropped. Coverage of the must-use words is reported for the repair decision.
 */
export function select(
  slot: Slot,
  checked: readonly Checked[],
  count: number,
  already: readonly Checked[] = [],
): Selection {
  const passing = checked.filter((c) => c.problems.length === 0)
  const ranked = [...passing].sort((a, b) => b.score - a.score || a.index - b.index)
  const chosen: Checked[] = [...already]
  const rejected: Checked[] = checked.filter((c) => c.problems.length > 0)
  for (const c of ranked) {
    if (chosen.length >= count) {
      rejected.push({ ...c, problems: ['not needed: enough phrases already'] })
      continue
    }
    const near = chosen.find(
      (d) => jaccard(tokens(d.candidate.target), tokens(c.candidate.target)) >= JACCARD_NEAR,
    )
    if (near) {
      rejected.push({ ...c, problems: [`too close to «${near.candidate.target}»`] })
      continue
    }
    chosen.push(c)
  }
  const covered = new Set(chosen.flatMap((c) => c.uses))
  const mustUse = slot.brief.mustUse.map((l) => l.lemma)
  const missing = mustUse.filter((l) => !covered.has(l))
  return {
    chosen,
    rejected,
    missing,
    coverage: mustUse.length === 0 ? 1 : covered.size / mustUse.length,
  }
}

/**
 * Room for a repair round when the set is full but short of must-use coverage: drops up to `n` of
 * the chosen phrases that add no must-use word the others lack, lowest score first, so the next
 * candidates can bring the missing words in. Phrases that alone cover a word are kept.
 */
export function makeRoom(chosen: readonly Checked[], n: number): Checked[] {
  const kept = [...chosen]
  const removable = () =>
    kept
      .filter((c) => c.uses.every((u) => kept.some((d) => d !== c && d.uses.includes(u))))
      .sort((a, b) => a.score - b.score || b.index - a.index)
  for (let i = 0; i < n; i += 1) {
    const [victim] = removable()
    if (!victim) break
    kept.splice(kept.indexOf(victim), 1)
  }
  return kept
}
