/**
 * The provider seam.
 *
 * `AI_PROVIDER` used to be a branch inside the service, so "what happens when the
 * configured provider is not registered" was only assertable by editing an environment
 * variable and booting the whole app. These tests hold the two rules that make AI a
 * garnish rather than a dependency (ADR-0010, rule 9):
 *   • a provider that produces an invalid scene cannot reach a learner;
 *   • an unregistered provider degrades to the bundled scene rather than failing.
 */

import { describe, expect, it } from 'vitest'
import { AiService } from './ai.service.js'
import { bundledScene } from './bundled-scenes.js'
import type { SceneProvider, SceneResult } from './scene-provider.js'
import { StubSceneProvider } from './scene-provider.stub.js'

/** A provider that answers to whatever `AI_PROVIDER` is set to, per theme. */
class FakeProvider implements SceneProvider {
  constructor(
    readonly name: string,
    private readonly per: (theme: string) => SceneResult,
  ) {}

  scene(theme: string): Promise<SceneResult> {
    return Promise.resolve(this.per(theme))
  }
}

const configuredProvider = (): string => process.env['AI_PROVIDER'] ?? 'stub'

describe('the AI scene pipeline', () => {
  it('serves the bundled scene under the stub provider', async () => {
    const served = await new AiService([new StubSceneProvider()]).scene('Hotel')
    expect(served).toEqual({
      id: 'scn_hotel',
      scene: bundledScene('Hotel'),
      cached: false,
      fallback: true,
    })
  })

  it('defaults the theme when the request names none', async () => {
    const ai = new AiService([new StubSceneProvider()])
    expect((await ai.scene(undefined)).scene).toEqual(bundledScene('Café'))
    // A client that sends `"theme": null` must get the default too, not a crash.
    expect((await ai.scene(null as unknown as undefined)).id).toBe('scn_café')
  })

  it('echoes the REQUESTED theme in the id even when it served the default scene', async () => {
    const served = await new AiService([new StubSceneProvider()]).scene('Bar')
    expect(served.id).toBe('scn_bar')
    expect(served.scene).toEqual(bundledScene('Café'))
  })

  it('never serves a scene that fails validation — it re-asks for the default theme', async () => {
    // Two "best" options would teach the wrong lesson, so this must never be served,
    // whatever produced it.
    const broken = structuredClone(bundledScene('Hotel'))
    for (const option of broken.turns[0]?.options ?? []) option.best = true

    const ai = new AiService([
      new FakeProvider(configuredProvider(), (theme) =>
        theme === 'Hotel'
          ? { scene: broken, cached: true, fallback: false }
          : { scene: bundledScene(theme), cached: false, fallback: true },
      ),
    ])

    // NOTE: the retry goes back to the SAME provider for the default theme, which is
    // the behaviour as shipped — a provider broken for every theme would still be asked
    // twice. A repair-then-fallback ladder would close that hole.
    expect(await ai.scene('Hotel')).toEqual({
      id: 'fallback',
      scene: bundledScene('Café'),
      cached: false,
      fallback: true,
    })
  })

  it('degrades to the bundled scene when the configured provider is not registered', async () => {
    // The M3 case: `AI_PROVIDER=anthropic` on an image where that provider does not
    // exist yet. It must serve a scene, not a 500.
    const served = await new AiService([]).scene('Hotel')
    expect(served).toEqual({
      id: 'scn_hotel',
      scene: bundledScene('Hotel'),
      cached: false,
      fallback: true,
    })
  })

  it('offers the bundled themes, so every theme on offer has a scene behind it', () => {
    const ai = new AiService([new StubSceneProvider()])
    expect(ai.themes()).toEqual(['Café', 'Hotel'])
    for (const theme of ai.themes()) expect(bundledScene(theme)).toBeDefined()
  })
})
