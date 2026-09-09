import { describe, expect, it } from 'vitest'
import { IMPORT_MAX_FILE_BYTES, decodeImportFile } from './importFile'

const encoder = new TextEncoder()

describe('offline import files', () => {
  it('accepts only UTF-8 text and tab-separated files', () => {
    expect(
      decodeImportFile({ name: 'phrases.txt', bytes: encoder.encode('Hola | Hello') }),
    ).toEqual({
      ok: true,
      text: 'Hola | Hello',
    })
    expect(decodeImportFile({ name: 'phrases.tsv', bytes: encoder.encode('Hola\tHello') })).toEqual(
      {
        ok: true,
        text: 'Hola\tHello',
      },
    )
    expect(decodeImportFile({ name: 'phrases.csv', bytes: encoder.encode('Hola,Hello') })).toEqual({
      ok: false,
      error: 'unsupported-format',
    })
  })

  it('rejects oversized and malformed UTF-8 files before a review can start', () => {
    expect(
      decodeImportFile({ name: 'large.txt', bytes: new Uint8Array(IMPORT_MAX_FILE_BYTES + 1) }),
    ).toEqual({ ok: false, error: 'too-large' })
    expect(decodeImportFile({ name: 'bad.txt', bytes: new Uint8Array([0xc3, 0x28]) })).toEqual({
      ok: false,
      error: 'unsupported-encoding',
    })
  })
})
