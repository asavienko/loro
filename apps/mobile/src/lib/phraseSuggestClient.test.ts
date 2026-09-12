import { describe, expect, it, vi } from 'vitest'
import { requestPhraseSuggestions } from './phraseSuggestClient'

describe('Discover phrase suggest client', () => {
  it('uses the API candidates when the draft contract is valid', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          fallback: true,
          provenance: 'bundled',
          candidates: [
            {
              target_text: 'La cuenta, por favor.',
              translation: 'The bill, please.',
              theme: 'Café',
              emoji: '☕',
              provenance: 'bundled',
              source: 'generated',
              needs_review: true,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    const rows = await requestPhraseSuggestions(
      {
        query: 'bill',
        nativeLanguage: 'en',
        targetLocale: 'es-ES',
        existingTexts: [],
      },
      'http://127.0.0.1:3000/v1',
      send,
    )
    expect(send).toHaveBeenCalled()
    expect(rows).toEqual([
      {
        targetText: 'La cuenta, por favor.',
        translation: 'The bill, please.',
        theme: 'Café',
        emoji: '☕',
        provenance: 'bundled',
        source: 'generated',
        needsReview: true,
      },
    ])
  })

  it('keeps bundled topics when the API is missing or unavailable', async () => {
    const missing = await requestPhraseSuggestions(
      {
        query: 'pharmacy',
        nativeLanguage: 'en',
        targetLocale: 'es-ES',
        existingTexts: [],
      },
      null,
    )
    expect(missing.length).toBeGreaterThan(0)
    const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))
    const fallback = await requestPhraseSuggestions(
      {
        query: 'pharmacy',
        nativeLanguage: 'en',
        targetLocale: 'es-ES',
        existingTexts: [],
      },
      'https://auth.loro.test/v1',
      failed,
    )
    expect(fallback.length).toBeGreaterThan(0)
    const emptyBundled = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ fallback: true, provenance: 'bundled', candidates: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    const recovered = await requestPhraseSuggestions(
      {
        query: 'pharmacy',
        nativeLanguage: 'en',
        targetLocale: 'es-ES',
        existingTexts: [],
      },
      'https://auth.loro.test/v1',
      emptyBundled,
    )
    expect(recovered.length).toBeGreaterThan(0)
  })
})
