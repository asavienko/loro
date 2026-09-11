/** F-03: no raw TextInput leftovers; no leftover 48/13/hairline list-row clusters. */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SOURCE = /\.(ts|tsx)$/
const TEXTINPUT_IMPORT = /(?:import\s*\{[^}]*\bTextInput\b[^}]*\}\s*from\s*['"]react-native['"])|(?:import\s+TextInput\s+from\s*['"]react-native['"])/

const IGNORE_CLUSTER = new Set([
  'src/ui/components/NavigationMenu.tsx',
  'app/listen-export.tsx',
])

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) walk(file, files)
    else if (SOURCE.test(entry.name)) files.push(file)
  }
  return files
}

export function isTextInputExempt(relativePath) {
  return (
    relativePath === 'src/ui/primitives/Field.tsx' ||
    relativePath === 'src/lib/copyOwnership.test.ts' ||
    /\.test\.(ts|tsx)$/.test(relativePath)
  )
}

/**
 * A leftover ListRow is the 48 / 13 / hairline cluster together — named or inlined.
 * `ROW_PADDING = 13` alone (NavigationMenu, listen-export) is not a hit.
 */
export function hasListRowCluster(source) {
  const namedHeight = /\bMIN_ROW_HEIGHT\s*=\s*48\b/.test(source)
  const namedPadding = /\bROW_PADDING\s*=\s*13\b/.test(source)
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const window = lines.slice(Math.max(0, index - 8), index + 12).join('\n')
    const height48 =
      /minHeight:\s*48\b/.test(window) || (namedHeight && /minHeight:\s*MIN_ROW_HEIGHT\b/.test(window))
    const pad13 =
      /paddingVertical:\s*13\b/.test(window) ||
      (namedPadding && /paddingVertical:\s*ROW_PADDING\b/.test(window))
    const hair =
      /borderBottomWidth:\s*border\.hairline\b/.test(window) ||
      (/borderBottomWidth:/.test(window) && /border\.hairline/.test(window))
    if (height48 && pad13 && hair) return true
  }
  return false
}

export function reuseErrors(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const mobile = join(root, 'apps/mobile')
  const errors = []
  for (const base of ['app', 'src']) {
    for (const file of walk(join(mobile, base))) {
      const relativePath = relative(mobile, file).replaceAll('\\', '/')
      const source = readFileSync(file, 'utf8')
      if (!isTextInputExempt(relativePath) && TEXTINPUT_IMPORT.test(source)) {
        errors.push(`Raw TextInput: ${relativePath} — use Field`)
      }
      if (IGNORE_CLUSTER.has(relativePath)) continue
      if (hasListRowCluster(source)) {
        errors.push(`Leftover 48/13/hairline list-row cluster: ${relativePath} — use ListRow`)
      }
    }
  }
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = reuseErrors()
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Reuse verified: no raw TextInput; no leftover 48/13/hairline clusters.')
}
