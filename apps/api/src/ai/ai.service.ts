/**
 * The AI proxy — docs/architecture/ai-services.md, ADR-0010.
 *
 * AI is a garnish, never a dependency. Every learner-facing path has a BUNDLED
 * FALLBACK that is good, not merely non-broken — and the fallback is the local
 * default, so it stays exercised and can't silently rot.
 *
 * This service owns the PIPELINE — rate limit → budget → cache → provider → VALIDATE →
 * fallback — and nothing else. The scenes are in `bundled-scenes.ts`, the invariants in
 * `scene.ts`, and each provider in its own `scene-provider.*.ts`. Validation lives here
 * rather than in the controller because "nothing invalid reaches a learner" is a
 * property of the pipeline, not of HTTP: a worker or a second transport must get the
 * same guarantee.
 */

import { Inject, Injectable, Logger } from '@nestjs/common'
import { config } from '../common/config.js'
import { DEFAULT_THEME, bundledScene, bundledThemes } from './bundled-scenes.js'
import { SCENE_PROVIDERS, type SceneProvider, type SceneResult } from './scene-provider.js'
import { validateScene } from './scene.js'

/** A scene the service is willing to serve, with the id the wire reports. */
export interface ServedScene extends SceneResult {
  /** `scn_<theme>`, or `fallback` when validation rejected what the provider produced. */
  id: string
}

/** The id reported when a produced scene failed validation. */
const FALLBACK_SCENE_ID = 'fallback'

@Injectable()
export class AiService {
  private readonly logger = new Logger('ai')
  private readonly providers: Map<string, SceneProvider>

  constructor(@Inject(SCENE_PROVIDERS) providers: SceneProvider[]) {
    this.providers = new Map(providers.map((p) => [p.name, p]))
  }

  /** The configured provider, as `/ai/themes` reports it. */
  get providerName(): string {
    return config.aiProvider()
  }

  /**
   * A roleplay scene, guaranteed to satisfy the pedagogical invariants.
   *
   * A scene that fails validation never reaches a learner — one with two "best"
   * options would teach the wrong lesson — so a rejected scene is replaced by the
   * bundled default rather than repaired here.
   */
  async scene(theme: string | undefined): Promise<ServedScene> {
    // `??` and not a default parameter: a client that sends `"theme": null` gets the
    // default, exactly as it did when this lived in the controller.
    const requested = theme ?? DEFAULT_THEME
    const produced = await this.produce(requested)

    if (!validateScene(produced.scene).ok) {
      const safe = await this.produce(DEFAULT_THEME)
      return { id: FALLBACK_SCENE_ID, scene: safe.scene, cached: false, fallback: true }
    }

    // The REQUESTED theme, even when an unknown one was served the default scene: the
    // id echoes what the client asked for.
    return { id: `scn_${requested.toLowerCase()}`, ...produced }
  }

  themes(): string[] {
    return bundledThemes()
  }

  /**
   * Ask the configured provider, or degrade if there isn't one.
   *
   * An `AI_PROVIDER` with no registered provider is a misconfiguration, and it degrades
   * loudly in the log and silently to the learner — which is the documented posture for
   * every AI path (`BUDGET_EXCEEDED: use the bundled fallback SILENTLY`).
   */
  private produce(theme: string): Promise<SceneResult> {
    const provider = this.providers.get(this.providerName)
    if (provider === undefined) {
      this.logger.warn(`provider '${this.providerName}' not wired yet — serving the bundled scene`)
      return Promise.resolve({ scene: bundledScene(theme), cached: false, fallback: true })
    }
    return provider.scene(theme)
  }
}
