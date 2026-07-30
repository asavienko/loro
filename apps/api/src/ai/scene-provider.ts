/**
 * The scene provider seam.
 *
 * `AI_PROVIDER` used to be a branch inside `AiService`, which meant the live provider
 * could only arrive as a second branch in the same method — and every provider after
 * that as a third. A provider is now a class that registers itself under the name
 * `AI_PROVIDER` selects, so adding Claude (plans/26, plans/45) is a new file plus one
 * line in `app.module.ts` (Open/Closed).
 *
 * See docs/architecture/ai-services.md and ADR-0010.
 */

import type { Scene } from './scene.js'

/** What a provider returns. `cached` and `fallback` are reported on the wire. */
export interface SceneResult {
  scene: Scene
  /** Served from the AI cache rather than freshly generated. */
  cached: boolean
  /** This is a bundled scene, not a generated one. */
  fallback: boolean
}

export interface SceneProvider {
  /**
   * The `AI_PROVIDER` value that selects this provider — the registry key. `stub`
   * matches the local and CI default.
   */
  readonly name: string

  /**
   * A scene for a theme.
   *
   * Promise-returning even though the bundled provider answers immediately: the
   * implementation that matters is an HTTP call to Claude, and a synchronous seam
   * would mean the interface has to change the day it lands.
   *
   * A provider MAY return an invalid scene — validation is the service's job, and a
   * provider that validated itself would be trusted to grade its own homework.
   */
  scene(theme: string): Promise<SceneResult>
}

/** Nest DI token for every registered provider. Injected as `SceneProvider[]`. */
export const SCENE_PROVIDERS = 'SCENE_PROVIDERS'
