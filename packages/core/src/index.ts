/**
 * @loro/core — shared domain model, used by apps/api and packages/content.
 *
 * Rules for this package:
 *   • No platform imports (no react, react-native, @nestjs/*, node:*)
 *   • No I/O — types, schemas, and pure functions only
 *   • Reproducible maths belongs in @loro/core-rs, not here (ADR-0002). `domain/calendar.ts`
 *     is a declared exception: it mirrors `core-rs/src/calendar.rs` for JS callers until
 *     plan 70. UniFFI already exports the same functions; the JSON WASM bridge does not
 *     dispatch calendar methods. A shared fixture fails the build if the two drift. See
 *     its header, and plans/archive/2026-07-30/05-fix-shared-maths-duplication.md.
 */

export * from './domain/ids.js'
export * from './domain/phrase.js'
export * from './domain/calendar.js'
export * from './domain/text.js'
export * from './domain/phraseReach.js'

export { FIELD_POLICY, mergeClassFor, mergeClassOf, isSyncEntity } from './sync/fieldPolicy.js'
export type { MergeClass, SyncEntity } from './sync/fieldPolicy.js'

export * from './domain/languages.js'
export * from './domain/lyrics.js'
export * from './domain/lyric-plan.js'
export * from './listening/index.js'
