// Bundle WASM as bytes so Metro's production export works offline without a fetch URL.
import { readFileSync, writeFileSync } from 'node:fs'
const bytes = readFileSync(new URL('../pkg-web/loro_core_bg.wasm', import.meta.url))
writeFileSync(
  new URL('../pkg-web/bytes.js', import.meta.url),
  `export default new Uint8Array([${Array.from(bytes).join(',')}]);\n`,
)
writeFileSync(
  new URL('../pkg-web/bytes.d.ts', import.meta.url),
  'declare const bytes: Uint8Array; export default bytes;\n',
)
// Metro does not support import.meta. init always receives bytes from our loader.
const glue = new URL('../pkg-web/loro_core.js', import.meta.url)
writeFileSync(
  glue,
  readFileSync(glue, 'utf8').replace(
    "new URL('loro_core_bg.wasm', import.meta.url)",
    "(() => { throw new Error('WASM bytes must be supplied'); })()",
  ),
)
