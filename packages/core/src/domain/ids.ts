/**
 * Branded id types. Passing a catalog id where a user-phrase id is expected is a
 * compile error, which matters because the two are joined constantly and mixing
 * them up would silently read the wrong row.
 */

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** A catalog phrase id — 'cafe1'. Immutable forever. */
export type CatalogPhraseId = Brand<string, 'CatalogPhraseId'>

/** A learner's row id — uuid. NOT the catalog id. */
export type UserPhraseId = Brand<string, 'UserPhraseId'>

// The casts mark a boundary where a string is *parsed* into an id; they belong at
// deserialisation points, never mid-logic. `userPhraseId(catalogPhrase.id)` type-checks
// and is a bug: the learner's row id is not the content team's phrase id.
export const catalogPhraseId = (s: string): CatalogPhraseId => s as CatalogPhraseId
export const userPhraseId = (s: string): UserPhraseId => s as UserPhraseId
