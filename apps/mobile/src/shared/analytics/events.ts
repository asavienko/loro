// What product analytics records of the learner's actions (ADR-0011): every event the store
// dispatches, by name, with its scalar fields and the phrase it acted on. Pure, so it is tested
// here and the app only sends what this returns (src/analytics).
import type { AppEvent, AppEventType } from '../state/machine';
import { currentPhraseId } from '../state/selectors';
import type { AppState } from '../state/types';

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export interface AnalyticsEvent {
  name: string;
  properties: AnalyticsProperties;
}

/**
 * Not recorded: bookkeeping the app does on its own (the rating window closing, saves arriving,
 * the phase clock ticking). A phase that fails to play is recorded as `audio_failed`.
 */
const SILENT = new Set<AppEventType>(['COMMIT', 'RESTORE', 'MERGE_REMOTE', 'PHASE_DONE']);

/** Fields that carry no meaning for analysis: timestamps, shuffle seeds, render counters. */
const DROPPED = new Set(['type', 'now', 'seed', 'cycle']);

/** `TOGGLE_SHUFFLE` → `toggle_shuffle`; field `phraseIds` → `phrase_ids`. */
const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** The event as analytics records it, or null for events it doesn't record. */
export function analyticsEvent(event: AppEvent, before: AppState): AnalyticsEvent | null {
  if (event.type === 'PHASE_DONE') {
    if (!event.failure) return null;
    const { reason, lang } = event.failure;
    return { name: 'audio_failed', properties: { reason, lang, phase: before.player.phase, phrase_id: currentPhraseId(before.player) } };
  }
  if (SILENT.has(event.type)) return null;
  const properties: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(event)) {
    if (DROPPED.has(key) || value === undefined) continue;
    const name = snake(key);
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') properties[name] = value;
    // Lists are counted; nested objects (notes, prefs, profiles) are flattened one level.
    else if (Array.isArray(value)) properties[`${name}_count`] = value.length;
    else if (typeof value === 'object') {
      for (const [inner, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') properties[`${name}_${snake(inner)}`] = v;
      }
    }
  }
  // Player events act on the phrase playing: name it, and where in the loop the learner was.
  if (before.player.status !== 'idle' && !('phraseId' in event)) {
    properties.phrase_id = currentPhraseId(before.player);
    properties.phase = before.player.phase;
    properties.set_id ??= before.player.setId;
  }
  return { name: snake(event.type), properties };
}
