// Copies the app's icon fonts into public/ for the scenes: the same Material Symbols subset the app
// ships, so every icon in the video is the one the app draws.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(ROOT, 'public/fonts'), { recursive: true })
for (const f of ['MaterialSymbols.ttf', 'MaterialSymbolsFill.ttf'])
  copyFileSync(join(ROOT, '../mobile/assets/fonts', f), join(ROOT, 'public/fonts', f))
console.log('Copied the icon fonts to public/fonts')
