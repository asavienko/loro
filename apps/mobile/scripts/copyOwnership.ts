/**
 * Static ownership gate for learner-facing mobile copy.
 *
 * This intentionally parses TypeScript/JSX instead of searching raw text. It checks only
 * presentation surfaces where a literal is necessarily learner-facing:
 *
 * - rendered JSX text;
 * - visible/accessibility copy props; and
 * - the message passed directly to `showToast`.
 *
 * Narrow exceptions are structural by construction: route ids, semantic keys, diagnostics,
 * tests, catalog content, regexes, styles, and ordinary implementation strings are not one of
 * those surfaces. `copy.ts` is the owner and is excluded. E2E is a frozen consumer contract and
 * is outside the source globs. Add a new AST surface here when the UI gains another copy-bearing
 * API; do not add a blanket identifier/string regex.
 *
 * Run: pnpm --filter @loro/mobile check:copy
 */

import { globSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export interface CopyFinding {
  readonly file: string
  readonly line: number
  readonly message: string
}

const SOURCE_GLOBS = ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}']
const OWNERSHIP_EXCLUDES = ['src/lib/copy.ts', '.test.', '.spec.', 'node_modules']

/** Props whose static value is presented or spoken to the learner. */
const COPY_PROPS = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'body',
  'emoji',
  'glyph',
  'hint',
  'label',
  'meta',
  'placeholder',
  'sub',
  'title',
])

function literalValue(node: ts.Node | undefined): string | null {
  if (node === undefined) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isJsxExpression(node)) return literalValue(node.expression)
  return null
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function callName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

export function findCopyViolations(sourceText: string, file = 'source.tsx'): CopyFinding[] {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const findings: CopyFinding[] = []

  const report = (node: ts.Node, surface: string, value: string): void => {
    if (value.length === 0) return
    findings.push({
      file,
      line: lineOf(source, node),
      message: `${surface} contains learner-facing literal ${JSON.stringify(value)}; use src/lib/copy.ts`,
    })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.getText(source).trim()
      if (text.length > 0) report(node, 'JSX text', text)
    } else if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      const value = literalValue(node)
      if (value !== null) report(node, 'JSX text expression', value)
    } else if (ts.isJsxAttribute(node) && COPY_PROPS.has(node.name.getText(source))) {
      const value = literalValue(node.initializer)
      if (value !== null) report(node, `JSX ${node.name.getText(source)} prop`, value)
    } else if (ts.isCallExpression(node) && callName(node.expression) === 'showToast') {
      const value = literalValue(node.arguments[0])
      if (value !== null) report(node.arguments[0] ?? node, 'showToast message', value)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

function sourceFiles(): string[] {
  return SOURCE_GLOBS.flatMap((glob) => globSync(glob)).filter(
    (file) => !OWNERSHIP_EXCLUDES.some((part) => file.includes(part)),
  )
}

export function checkCopyOwnership(): CopyFinding[] {
  return sourceFiles().flatMap((file) => findCopyViolations(readFileSync(file, 'utf8'), file))
}

function main(): void {
  const files = sourceFiles()
  const findings = files.flatMap((file) => findCopyViolations(readFileSync(file, 'utf8'), file))
  if (findings.length === 0) {
    console.log(`copy/ownership: ok (${files.length} source files scanned)`)
    return
  }

  console.error(`copy/ownership: ${findings.length} finding(s)`)
  for (const finding of findings) {
    console.error(`  ${basename(finding.file)}:${finding.line}  ${finding.message}`)
  }
  process.exitCode = 1
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && fileURLToPath(import.meta.url) === resolve(invokedPath)) main()
