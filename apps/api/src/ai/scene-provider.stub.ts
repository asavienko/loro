/**
 * `AI_PROVIDER=stub` — serve the bundled catalog.
 *
 * The local and CI default, which is the point: the bundled fallback is the path a
 * learner hits offline, over budget, or when Claude refuses, so it is the path
 * development exercises every day rather than a branch nobody runs (ADR-0010).
 */

import { Injectable } from '@nestjs/common'
import { bundledScene } from './bundled-scenes.js'
import type { SceneProvider, SceneResult } from './scene-provider.js'

@Injectable()
export class StubSceneProvider implements SceneProvider {
  readonly name = 'stub'

  scene(theme: string): Promise<SceneResult> {
    // `fallback: true` is honest, not a placeholder: this IS the bundled scene, and the
    // client shows it as one.
    return Promise.resolve({ scene: bundledScene(theme), cached: false, fallback: true })
  }
}
