/** F-08 / plan 72. Build-time fixture only; never transform catalog or parameter values. */
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'

const accents: Record<string, string> = {
  a: 'áá',
  e: 'ëë',
  i: 'ïï',
  o: 'öö',
  u: 'üü',
  A: 'ÁÁ',
  E: 'ËË',
  I: 'ÏÏ',
  O: 'ÖÖ',
  U: 'ÜÜ',
}

/** Transform parsed literals, retaining ICU syntax, plural selectors and named arguments. */
export function pseudoMessage(template: string): string {
  const replacements: { start: number; end: number; value: string }[] = []
  const collect = (nodes: MessageFormatElement[], inPlural = false): void => {
    for (const node of nodes) {
      if (node.type === TYPE.literal) {
        const location = node.location
        if (location === undefined) throw new Error('Pseudo-locale requires ICU source locations')
        const value = node.value.replace(/[aeiou]/gi, (letter) => accents[letter] ?? letter)
        replacements.push({
          start: location.start.offset,
          end: location.end.offset,
          // Literal ICU punctuation must stay literal after removing the source quoting.
          value: value
            .replace(/'/g, "''")
            .replace(inPlural ? /[{}<#]/g : /[{}<]/g, (character) => `'${character}'`),
        })
      } else if (node.type === TYPE.select || node.type === TYPE.plural) {
        Object.values(node.options).forEach((option) => {
          collect(option.value, inPlural || node.type === TYPE.plural)
        })
      } else if (node.type === TYPE.tag) {
        collect(node.children, inPlural)
      }
    }
  }
  collect(parse(template, { captureLocation: true }))
  let result = template
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end)
  }
  return `[!! ${result} !!]`
}

export function pseudoResources<T extends Record<string, string>>(resources: T): T {
  return Object.fromEntries(
    Object.entries(resources).map(([key, value]) => [key, pseudoMessage(value)]),
  ) as T
}
