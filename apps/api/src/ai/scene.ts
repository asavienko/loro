/**
 * What a roleplay scene is, and the invariants it must satisfy to reach a learner.
 *
 * Separate from the service because these are pedagogical rules, not proxy plumbing:
 * they hold whoever produced the scene — Claude, the bundled catalog, a future
 * provider — and they are worth unit-testing without a Nest container.
 *
 * See docs/architecture/ai-services.md and ADR-0010.
 */

export interface SceneOption {
  es: string
  en: string
  best?: boolean
  tip: string
  phrase_id?: string
}

export interface SceneTurn {
  npc: { es: string; en: string }
  options: SceneOption[]
}

export interface Scene {
  place: string
  city: string
  emoji: string
  role: string
  turns: SceneTurn[]
  closer: { es: string; en: string }
}

/** Why a scene was rejected. `reason` is for logs, never for a learner. */
export interface SceneCheck {
  ok: boolean
  reason?: string
}

/**
 * The blueprint's roleplay screen shows three options per turn and marks exactly one as
 * how a local would say it. These are the numbers that shape makes true.
 */
const OPTIONS_PER_TURN = 3
const BEST_OPTIONS_PER_TURN = 1
/** A tip shorter than this is a label, not a coach note. */
const MIN_TIP_CHARS = 10
/** An option a learner cannot hold in their head is not a speaking option. */
const MAX_OPTION_WORDS = 12

/**
 * A scene is rejected unless the pedagogical invariants hold. The structure check
 * matters less than "exactly one best option" — that distinction is the payload of the
 * whole screen.
 */
export function validateScene(scene: Scene): SceneCheck {
  if (scene.turns.length < 1) return { ok: false, reason: 'no_turns' }
  for (const t of scene.turns) {
    if (t.options.length !== OPTIONS_PER_TURN) return { ok: false, reason: 'option_count' }
    if (t.options.filter((o) => o.best === true).length !== BEST_OPTIONS_PER_TURN) {
      return { ok: false, reason: 'best_count' }
    }
    if (t.options.some((o) => o.tip.length < MIN_TIP_CHARS)) {
      return { ok: false, reason: 'tip_missing' }
    }
    if (t.options.some((o) => o.es.split(/\s+/).length > MAX_OPTION_WORDS)) {
      return { ok: false, reason: 'too_long' }
    }
    if (new Set(t.options.map((o) => o.es)).size !== OPTIONS_PER_TURN) {
      return { ok: false, reason: 'duplicate_options' }
    }
  }
  return { ok: true }
}
