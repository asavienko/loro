/** Text limits, shared by the forms (maxLength), the reducer and data loaded or synced. */
export const LIMITS = { phrase: 120, title: 60, name: 40 } as const;

/** Notes written for one of the learner's own phrases (AI's), as stored and synced. */
export const NOTE_LIMITS = { title: 60, text: 300 } as const;

/** Whitespace folded as it's stored: pasted lines and tabs become single spaces. */
export const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');

/**
 * At most `max` UTF-16 units (what maxLength counts), never cut inside a surrogate pair,
 * so a clipped emoji doesn't leave half a character behind.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const last = text.charCodeAt(max - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? max - 1 : max;
  return text.slice(0, end).trimEnd();
}
