/**
 * Composites — the shapes a SCREEN is made of, above the primitives.
 *
 * These may know what a phrase is: `DifficultySelector` and `TagSelector` take the domain's
 * own `Difficulty` and `Tag` types, and `PhraseRow` knows a phrase has a Spanish line that
 * must carry `lang="es"`. That is the line the layer rule at `eslint.config.mjs:83-97` draws —
 * a primitive that took a `phrase` prop would belong here instead.
 *
 * What they must NOT know is copy. Every string is a prop; `src/lib/copy.ts` is the catalog and
 * the screen reads from it. A component that imports copy cannot be reused by a screen that
 * says something slightly different, and that is how four hand-rolled empty states happened.
 */

export { BottomActionBar } from './BottomActionBar'
export { DifficultySelector } from './DifficultySelector'
export { EmptyState } from './EmptyState'
export { PhraseRow } from './PhraseRow'
export { StatRow, type Stat } from './StatRow'
export { TagSelector } from './TagSelector'
