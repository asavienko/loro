// The player's Hint (v2-prototype-decisions.md, "Player"): how the phrase starts, never all of it.
// "¿Dónde está la estación?" → "¿Dónde está …?". The question or exclamation mark stays, so the hint
// still says what kind of sentence it is.

/** The first words of `target` and an ellipsis: a third of the words, one or two of them; for one word, its first letters. */
export function hintOf(target: string): string {
  const text = target.trim();
  const end = /[?!¿¡]$/.test(text) ? text.slice(-1) : '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const letters = Array.from(text.replace(/[\p{P}\s]+$/u, ''));
    const lead = /^\p{P}$/u.test(letters[0] ?? '') ? 1 : 0;
    const shown = letters.slice(0, lead + Math.max(1, Math.ceil((letters.length - lead) / 3)));
    return `${shown.join('')}…${end}`;
  }
  const count = Math.min(2, Math.max(1, Math.ceil(words.length / 3)), words.length - 1);
  const start = words.slice(0, count).join(' ').replace(/[\p{P}]+$/u, (p) => p.replace(/[^¿¡]/g, ''));
  return `${start} …${end}`;
}
