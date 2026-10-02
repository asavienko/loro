/** Plan 113: what the music model is asked for, from the song's style and the learner's options. */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SONG_OPTIONS } from '@loro/core'
import { livePrompt } from './music-live.js'

const sections = [
  { name: 'verse' as const, lines: [{ text: 'Hola', meaning: 'Hi', phraseId: 'p-1' }] },
  { name: 'chorus' as const, lines: [{ text: 'Adiós', meaning: 'Bye', phraseId: 'p-2' }] },
]

describe('the music prompt', () => {
  it('asks for the voice, tempo and mood chosen, and keeps the lyrics as written', () => {
    const prompt = livePrompt({
      sections,
      styleId: 'bossa_nova',
      targetLang: 'es-ES',
      options: {
        voice: 'duet',
        tempo: 'slow',
        mood: 'nostalgic',
        length: 'short',
        theme: 'my grandmother’s kitchen',
      },
    })
    expect(prompt).toContain('nostalgic')
    expect(prompt).toContain('a duet of a female and a male voice')
    expect(prompt).toContain('slow tempo')
    // The style's own pace would contradict the one chosen.
    expect(
      livePrompt({
        sections,
        styleId: 'modern_pop',
        targetLang: 'es-ES',
        options: { ...DEFAULT_SONG_OPTIONS, tempo: 'lively' },
      }),
    ).not.toContain('mid-tempo')
    expect(prompt).toContain('[verse]\nHola')
    // The learner's own words shaped the lyrics; they never reach the music provider.
    expect(prompt).not.toContain('grandmother')
  })

  it('leaves the voice and the pace to the style when none is chosen', () => {
    const prompt = livePrompt({
      sections,
      styleId: 'modern_pop',
      targetLang: 'es-ES',
      options: DEFAULT_SONG_OPTIONS,
    })
    expect(prompt).not.toMatch(/lead vocal|duet/)
    // The natural tempo is the style's own.
    expect(prompt).toContain('mid-tempo')
    expect(prompt).not.toContain('Keep a')
  })
})
