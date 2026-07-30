/**
 * Composites — the shapes a SCREEN is made of, above the primitives.
 *
 * These may know what a phrase is: `DifficultySelector` and `TagChips` take the domain's own
 * `Difficulty` and `Tag` types, and `PhraseRow` knows a phrase has a Spanish line that must carry
 * `lang="es"`. That is the line the layer rule at `eslint.config.mjs:83-97` draws — a primitive that
 * took a `phrase` prop would belong here instead.
 *
 * Two things they must NOT do:
 *
 * • **Import the store.** A domain component takes props, never a selector. A component that
 *   subscribes cannot be rendered twice with different data, and it drags the store into every test
 *   that renders it.
 * • **Import copy.** Every string is a prop; `src/lib/copy.ts` is the catalog and the screen reads
 *   from it. A component that holds its own words cannot be reused by a screen that says something
 *   slightly different — which is how four hand-rolled empty states happened.
 */

export { ActionBar } from './ActionBar'
export { DifficultySelector } from './DifficultySelector'
export { EmptyState } from './EmptyState'
export { PhraseRow } from './PhraseRow'
export { StatRow, type Stat } from './StatRow'
export { TagChips } from './TagChips'
