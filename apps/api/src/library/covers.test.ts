/** Plans 106, 111: a cover is shapes and colours, or a checked picture, and never markup from a model. */
import { describe, expect, it } from 'vitest'
import {
  CoverSpecSchema,
  coverImagePrompt,
  patternCover,
  readCoverSpec,
  renderCover,
  renderImageCover,
} from './covers.js'

describe('covers', () => {
  it('draws the same pattern for the same seed, and a different one for another', () => {
    expect(patternCover('Hotel nights')).toEqual(patternCover('Hotel nights'))
    expect(renderCover(patternCover('Hotel nights'))).not.toBe(renderCover(patternCover('Tapas')))
  })

  it('draws every pattern within the spec', () => {
    for (let i = 0; i < 200; i++)
      expect(CoverSpecSchema.safeParse(patternCover(`seed ${i}`)).success).toBe(true)
  })

  it('renders only shapes and a gradient, never text, links, images or scripts', () => {
    const svg = renderCover(patternCover('anything'))
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).not.toMatch(/<(script|text|image|a|foreignObject|use|style)\b/i)
    expect(svg).not.toMatch(/\bon[a-z]+=|href|javascript:/i)
  })

  it('keeps each shape to its own fields and drops shapes out of range', () => {
    const spec = readCoverSpec({
      background: ['#112233', '#445566', '#778899'],
      angle: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 10,
          cy: 10,
          r: 5,
          fill: '#ffffff',
          opacity: 1,
          d: 'M0 0',
          onload: 'x',
        },
        { kind: 'circle', cx: 10, cy: 10, r: 5, fill: 'red', opacity: 1 },
        {
          kind: 'path',
          d: 'M0 0 L10 10"/><script>',
          fill: null,
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1,
        },
        {
          kind: 'rect',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          radius: 0,
          rotate: 0,
          fill: '#000000',
          opacity: 0.5,
        },
      ],
    })
    expect(spec.background).toEqual(['#112233', '#445566'])
    expect(spec.shapes.map((s) => s.kind)).toEqual(['circle', 'rect'])
    expect(spec.shapes[0]).toEqual({
      kind: 'circle',
      cx: 10,
      cy: 10,
      r: 5,
      fill: '#ffffff',
      opacity: 1,
    })
  })

  it('refuses a spec with nothing drawable', () => {
    expect(() =>
      readCoverSpec({ background: ['#000000', '#ffffff'], angle: 0, shapes: [{ kind: 'text' }] }),
    ).toThrow()
  })

  it('carries a picture as base64 bytes of a known type, the size of the canvas', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x22, 0x3c, 0x3e])
    const svg = renderImageCover({ bytes, contentType: 'image/jpeg' })
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' +
        `<image width="512" height="512" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${bytes.toString('base64')}"/>` +
        '</svg>',
    )
    expect(() =>
      renderImageCover({ bytes, contentType: 'image/svg+xml' as unknown as 'image/png' }),
    ).toThrow()
  })

  it('asks for a wordless drawing of what the learner named', () => {
    const prompt = coverImagePrompt({ kind: 'album', title: 'Noches', description: 'flamenco' })
    expect(prompt).toContain('an album of songs titled "Noches", about: flamenco.')
    expect(prompt).toContain('Absolutely no text')
    expect(coverImagePrompt({ kind: 'set', title: 'Tapas' })).toContain(
      'a set of everyday phrases titled "Tapas".',
    )
    const asked = coverImagePrompt({
      kind: 'phrase',
      title: 'Un café',
      prompt: 'a cat drinking coffee',
    })
    expect(asked).toContain('Picture: a cat drinking coffee.')
    expect(asked).toContain('Absolutely no text')
    expect(coverImagePrompt({ kind: 'set', title: 'Tapas' })).not.toContain('Picture:')
  })
})
