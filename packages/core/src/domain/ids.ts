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

export type UserId = Brand<string, 'UserId'>
export type DeviceId = Brand<string, 'DeviceId'>
export type TripId = Brand<string, 'TripId'>
export type SessionId = Brand<string, 'SessionId'>
export type PackId = Brand<string, 'PackId'>
export type ScenarioId = Brand<string, 'ScenarioId'>
export type SceneId = Brand<string, 'SceneId'>

export const catalogPhraseId = (s: string): CatalogPhraseId => s as CatalogPhraseId
export const userPhraseId = (s: string): UserPhraseId => s as UserPhraseId
export const userId = (s: string): UserId => s as UserId
export const deviceId = (s: string): DeviceId => s as DeviceId
export const tripId = (s: string): TripId => s as TripId
export const sessionId = (s: string): SessionId => s as SessionId
export const packId = (s: string): PackId => s as PackId
export const scenarioId = (s: string): ScenarioId => s as ScenarioId
export const sceneId = (s: string): SceneId => s as SceneId
