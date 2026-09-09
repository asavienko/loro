/**
 * The bundled fallback scenes.
 *
 * Hand-authored, not placeholders — this is what an offline learner gets, what local
 * development uses, and what every failed provider call degrades to. Rule 9: AI has a
 * bundled fallback on every learner-visible path (ADR-0010).
 *
 * Data only. Held apart from `ai.service.ts` so the pipeline that selects and validates
 * a scene is readable without scrolling past 170 lines of Spanish.
 */

/**
 * API compatibility adapters for the shared, local-only roleplay catalog.
 * The content package is also a mobile dependency, so this never requires a request
 * or provider to complete a bundled scene.
 */
export {
  DEFAULT_ROLEPLAY_THEME as DEFAULT_THEME,
  bundledRoleplayScene as bundledScene,
  bundledRoleplayThemes as bundledThemes,
} from '@loro/content'
