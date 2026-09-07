/** Split migration scripts without splitting quoted text or SQL comments. */
export function sqlStatements(script: string): string[] {
  const statements: string[] = []
  let start = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < script.length; i++) {
    const ch = script[i]
    const next = script[i + 1]
    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) i++
        else quote = ''
      }
      continue
    }
    if (ch === '-' && next === '-') {
      lineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '[') {
      quote = ']'
      continue
    }
    if (ch === ';') {
      statements.push(script.slice(start, i + 1))
      start = i + 1
    }
  }
  if (quote || blockComment) throw new Error('Unterminated SQL script')
  if (script.slice(start).trim()) statements.push(script.slice(start))
  return statements
}
