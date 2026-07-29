/**
 * Accessibility gates that block merge.
 *
 * These two matter most because both are easy to forget on a new screen and both are
 * invisible to a sighted developer testing by hand:
 *
 *   lang            — Spanish text must carry lang="es-ES", or a screen reader
 *                     pronounces it in English and mangles it. The single
 *                     highest-impact accessibility detail in the app.
 *   chart-summaries — every chart needs an adjacent VISIBLE text summary. The labs'
 *                     feedback must be available without sight.
 *
 * Run: pnpm --filter @loro/mobile check:lang
 * See docs/architecture/accessibility.md
 */

import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { basename } from 'node:path'

interface Finding {
  file: string
  line: number
  message: string
}

const SOURCE_GLOBS = ['app/**/*.tsx', 'src/**/*.tsx']

function sources(): string[] {
  return SOURCE_GLOBS.flatMap((g) => globSync(g, { exclude: (p) => p.includes('node_modules') }))
}

function lines(file: string): string[] {
  return readFileSync(file, 'utf8').split('\n')
}

/** Spanish text is any JSX text node holding ¿ ¡ ñ or an accented vowel. */
const SPANISH = /[¿¡ñáéíóúÁÉÍÓÚÑ]/

/**
 * An explicit, reasoned waiver: `// a11y-lang: <why>` on the line or the one above.
 *
 * Needed because the accented characters that identify Spanish also appear in English
 * loanwords ("Café" as a UI category). A waiver is deliberately noisier than a
 * suppression flag — it has to state a reason, and it greps.
 */
const WAIVER = /\/\/\s*a11y-lang:\s*\S/

/**
 * Spanish punctuation inside a regex character class (`[¿?¡!,.]`) is a parser, not
 * display text. Strip regex literals before testing rather than reporting them and
 * teaching everyone to ignore this check.
 */
function withoutRegexLiterals(line: string): string {
  return line.replace(/\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuy]*/g, '/RE/')
}

export function checkSpanishLang(): Finding[] {
  const findings: Finding[] = []
  for (const file of sources()) {
    const src = lines(file)
    src.forEach((line, i) => {
      const code = withoutRegexLiterals(line)
      if (!SPANISH.test(code)) return
      // Comments and imports are not rendered text.
      const trimmed = code.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import'))
        return
      // The waiver may sit anywhere in the contiguous comment block above, so a
      // multi-line reason works — the point is that a reason exists.
      if (WAIVER.test(line)) return
      let waived = false
      for (let j = i - 1; j >= 0; j--) {
        const prev = (src[j] ?? '').trim()
        if (!prev.startsWith('//')) break
        if (WAIVER.test(prev)) {
          waived = true
          break
        }
      }
      if (waived) return
      // Look for a lang attribute on this line or the two above it (JSX wraps).
      const context = src.slice(Math.max(0, i - 2), i + 1).join(' ')
      if (!/lang\s*=\s*["'{]/.test(context)) {
        findings.push({
          file,
          line: i + 1,
          message: `Spanish text without lang="es-ES" — a screen reader will read it in English`,
        })
      }
    })
  }
  return findings
}

/** A Skia chart must have a sibling summary. */
const CHART_COMPONENTS = [
  'PitchContour',
  'RhythmBars',
  'WaveformPair',
  'ForgettingCurve',
  'Sparkline',
  'LadderHistogram',
  'EffortChart',
]

export function checkChartSummaries(): Finding[] {
  const findings: Finding[] = []
  for (const file of sources()) {
    const src = readFileSync(file, 'utf8')
    for (const chart of CHART_COMPONENTS) {
      if (!new RegExp(`<${chart}[\\s/>]`).test(src)) continue
      // The summary may be a <ChartSummary> component or an explicit prop.
      const hasSummary = /<ChartSummary[\s/>]/.test(src) || /\bsummary\s*=/.test(src)
      if (!hasSummary) {
        const line = src.split('\n').findIndex((l) => l.includes(`<${chart}`)) + 1
        findings.push({
          file,
          line,
          message: `<${chart}> has no visible text summary — the labs' feedback must work without sight`,
        })
      }
    }
  }
  return findings
}

/** Interactive elements need a 44x44 hit area. */
export function checkTapTargets(): Finding[] {
  const findings: Finding[] = []
  for (const file of sources()) {
    const src = lines(file)
    src.forEach((line, i) => {
      const m = /(?:width|height)\s*:\s*(\d+)/.exec(line)
      if (m === null) return
      const px = Number(m[1])
      if (px >= 44 || px === 0) return
      // Only flag it if the surrounding line looks interactive.
      if (!/Pressable|TouchableOpacity|onPress|hitSlop/.test(line)) return
      if (line.includes('hitSlop')) return
      findings.push({
        file,
        line: i + 1,
        message: `interactive element is ${px}px — needs a 44x44 hit area (add hitSlop)`,
      })
    })
  }
  return findings
}

const CHECKS: Record<string, () => Finding[]> = {
  lang: checkSpanishLang,
  'chart-summaries': checkChartSummaries,
  'tap-targets': checkTapTargets,
}

function main(): void {
  const which = process.argv[2] ?? 'all'
  const names = which === 'all' ? Object.keys(CHECKS) : [which]
  const fileCount = sources().length
  let failed = 0

  for (const name of names) {
    const check = CHECKS[name]
    if (check === undefined) {
      console.error(`unknown check '${name}'. Available: ${Object.keys(CHECKS).join(', ')}`)
      process.exit(2)
    }
    const findings = check()
    if (findings.length === 0) {
      console.log(`a11y/${name}: ok (${fileCount} file${fileCount === 1 ? '' : 's'} scanned)`)
    } else {
      failed += findings.length
      console.error(`\na11y/${name}: ${findings.length} finding(s)`)
      for (const f of findings) {
        console.error(`  ${basename(f.file)}:${f.line}  ${f.message}`)
      }
    }
  }

  if (failed > 0) {
    console.error('\nSee docs/architecture/accessibility.md')
    process.exit(1)
  }
}

main()
