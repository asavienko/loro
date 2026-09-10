/** Music logs may carry job codes only — never lyric or phrase text. */
const TEXT_KEYS = new Set([
  'target_text',
  'targetText',
  'translation',
  'lines',
  'gloss_lines',
  'title',
  'text',
  'positive_styles',
  'negative_styles',
])

export function redactMusicValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactMusicValue(entry))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      TEXT_KEYS.has(key) || key.endsWith('_text') || key === 'lines'
        ? '[redacted]'
        : redactMusicValue(entry),
    ]),
  )
}

export function assertNoLyricLeak(logLine: string): void {
  if (
    /cortado|leche|llevar|cuenta|dónde|donde|phrase text|Me pone/i.test(logLine) &&
    !logLine.includes('[redacted]')
  ) {
    throw new Error('Music log leaked lyric or phrase text')
  }
}
