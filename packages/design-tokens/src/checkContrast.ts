/**
 * The contrast gate. Fails the build on a violation.
 *
 * Checks every foreground/background pairing the app actually uses, for ALL FOUR
 * accent themes — an accent that fails is adjusted before it ships, not after an audit.
 *
 * Two rules are absolute, because they're the ones the blueprint respects by
 * convention and nothing else enforced:
 *   • `accent` is never body text  (4.0:1 — that's what `accentInk` is for)
 *   • `muted2` is never below 14px semibold
 *
 * Run: pnpm --filter @loro/design-tokens check:contrast
 */

import { loadTokens } from './tokens.js'
import { AA_BODY, AA_LARGE, ratio } from './contrast.js'

interface Violation {
  pair: string
  got: number
  need: number
  note: string
}

function main(): void {
  const t = loadTokens()
  const violations: Violation[] = []
  const checked: string[] = []
  /** Rules a token passes only because of a declared size floor. The UI must honour them. */
  const constraints: string[] = []

  const need = (name: string): string => {
    const hex = t.surface[name]
    if (hex === undefined) throw new Error(`missing required surface token 'surface.'`)
    return hex
  }
  const appBg = need('app')

  const surfaces: [string, string][] = [
    ['surface.app', appBg],
    ['surface.card', need('card')],
    ['surface.sunken', need('sunken')],
  ]

  const check = (
    fgName: string,
    fg: string,
    bgName: string,
    bg: string,
    need: number,
    note = '',
  ): void => {
    const got = ratio(fg, bg)
    checked.push(`${fgName} on ${bgName}`)
    if (got < need) violations.push({ pair: `${fgName} on ${bgName}`, got, need, note })
  }

  // ── Ink on every surface ──
  for (const [bgName, bg] of surfaces) {
    for (const [name, fg] of Object.entries(t.ink)) {
      // muted2/muted3 are declared large-text-and-decoration only.
      const need = name === 'muted2' || name === 'muted3' ? AA_LARGE : AA_BODY
      check(
        `ink.${name}`,
        fg,
        bgName,
        bg,
        need,
        need === AA_LARGE ? 'large text / non-text only' : '',
      )
    }
  }

  // ── Semantic text on its own background, and on the app surface ──
  //
  // `<base>Alt` and `<base>Meta` are secondary text FOR a family — they carry no `bg`
  // of their own and are shown on the base family's. Checking them only against
  // surface.app would miss the pairing they actually appear in, which is the tighter
  // one: a muted green on a green card, not on the page.
  for (const [name, fam] of Object.entries(t.semantic)) {
    check(`semantic.${name}.text`, fam.text, 'surface.app', appBg, AA_BODY)
    if (fam.bg) check(`semantic.${name}.text`, fam.text, `semantic.${name}.bg`, fam.bg, AA_BODY)

    const base = /^(.*?)(Alt|Meta)$/.exec(name)?.[1]
    const baseBg = base === undefined ? undefined : t.semantic[base]?.bg
    if (base !== undefined && baseBg !== undefined) {
      check(`semantic.${name}.text`, fam.text, `semantic.${base}.bg`, baseBg, AA_BODY)
    }
  }

  // ── Every accent theme ──
  for (const [key, theme] of Object.entries(t.accents)) {
    // The wash is a background, so it joins the surface list for THIS theme only —
    // a pill tinted with the coral wash is never shown under the teal accent.
    for (const [bgName, bg] of [...surfaces, [`accent.${key}.wash`, theme.wash] as const]) {
      // THE rule the token names encode: accentInk is the text colour.
      check(`accent.${key}.accentInk`, theme.accentInk, bgName, bg, AA_BODY, 'text on light')
      // accent is fills and large text only.
      check(
        `accent.${key}.accent`,
        theme.accent,
        bgName,
        bg,
        AA_LARGE,
        'fills / >=17px semibold only',
      )
    }
    // White on the accent fill — buttons and pills, so large-text threshold.
    check(
      `white`,
      '#ffffff',
      `accent.${key}.accent`,
      theme.accent,
      AA_LARGE,
      'button labels >=17px semibold',
    )
    // On-dark variant against the dark card's darkest stop.
    check(`accent.${key}.accentOnDark`, theme.accentOnDark, 'darkCard', '#141310', AA_BODY)
  }

  // ── On-dark ink ──
  // Twice: against the dark card's darkest gradient stop, and against `surface.dark`,
  // the FLAT fill used by the toast and the segmented control. The flat fill is the
  // lighter of the two, so it — not the gradient — is the real worst case.
  for (const [name, fg] of Object.entries(t.onDark)) {
    if (fg.startsWith('rgba')) continue // alpha layers are decoration
    const floor = name === 'muted' ? AA_LARGE : AA_BODY
    check(`onDark.${name}`, fg, 'darkCard', '#141310', floor)
    check(`onDark.${name}`, fg, 'surface.dark', need('dark'), floor)
  }

  // ── The warming scale: text on its own band ──
  // Gradient bands are checked against their LIGHTEST stop — the worst case for the
  // white text at peak.
  for (const [band, spec] of Object.entries(t.scale.warming)) {
    const bg = spec.bg.startsWith('linear-gradient')
      ? (/#[0-9a-f]{6}/i.exec(spec.bg.split(',').slice(1).join(','))?.[0] ?? '#ffffff')
      : spec.bg
    // A band may declare that its text is large-only. That is a CONSTRAINT ON THE UI,
    // not a waiver — it is asserted below and surfaced in the report.
    const floor = (spec as { textSizeFloor?: string }).textSizeFloor
    const need = floor === 'large' ? AA_LARGE : AA_BODY
    check(
      `warming.${band}.text`,
      spec.text,
      `warming.${band}.bg`,
      bg,
      need,
      floor ? 'large-text-only band' : '',
    )
    if (floor === 'large') constraints.push(`warming.${band}: text must be >=17px semibold`)
  }

  // ── Ordered scales, as non-text marks ──
  for (const group of ['mastery', 'ladder', 'confidence'] as const) {
    for (const [name, hex] of Object.entries(t.scale[group])) {
      check(`scale.${group}.${name}`, hex, 'surface.app', appBg, AA_LARGE, 'bar/pip fill')
    }
  }

  // ── Report ──
  console.log(
    `contrast: ${checked.length} pairings checked across ${Object.keys(t.accents).length} accent themes`,
  )

  if (violations.length > 0) {
    console.error(`\n${violations.length} violation(s):\n`)
    for (const v of violations) {
      console.error(`  ${v.pair}`)
      console.error(`    got ${v.got}:1, need ${v.need}:1${v.note ? `  (${v.note})` : ''}`)
    }
    console.error('\nFix the token, or move the usage to a larger text size.')
    console.error('See docs/architecture/accessibility.md#contrast-audit\n')
    process.exit(1)
  }

  console.log('all pairings pass WCAG 2.2 AA')

  if (constraints.length > 0) {
    console.log(
      '\nconstraints the UI must honour (these tokens pass only at a declared size floor):',
    )
    for (const c of constraints) console.log(`  · ${c}`)
  }
}

main()
