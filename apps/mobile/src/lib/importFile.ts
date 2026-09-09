/**
 * The file boundary for offline phrase import.  Selection belongs to the platform; this module
 * only accepts a bounded byte buffer and turns an explicitly supported UTF-8 text file into the
 * same input that the paste-review surface already requires.
 */

import { IMPORT_MAX_CHARACTERS } from './importPhrases'

/** UTF-8 can take three bytes for the BMP text learners normally import; leave BOM room. */
export const IMPORT_MAX_FILE_BYTES = IMPORT_MAX_CHARACTERS * 3 + 3

export type ImportFileError = 'unsupported-format' | 'too-large' | 'unsupported-encoding'

export type ImportFileResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: ImportFileError }

export interface ImportFileInput {
  readonly name: string
  readonly bytes: Uint8Array
}

/**
 * A CSV file is intentionally not accepted: commas are ordinary learner text and CSV quoting
 * would introduce a second, subtly different parser. `.txt` uses the existing `|` grammar and
 * `.tsv` uses its existing tab grammar.
 */
export function decodeImportFile({ name, bytes }: ImportFileInput): ImportFileResult {
  if (!/\.(?:txt|tsv)$/iu.test(name)) return { ok: false, error: 'unsupported-format' }
  if (bytes.byteLength > IMPORT_MAX_FILE_BYTES) return { ok: false, error: 'too-large' }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
    if (text.length > IMPORT_MAX_CHARACTERS) return { ok: false, error: 'too-large' }
    return { ok: true, text }
  } catch {
    return { ok: false, error: 'unsupported-encoding' }
  }
}
