/** Plan 106: a cover is shapes and colours only, whoever wrote its spec. */
import { describe, expect, it } from 'vitest'
import { CoverSpecSchema, patternCover, readCoverSpec, renderCover } from './covers.js'

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
})
