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

interface LiteralPart {
  readonly node: ts.Node
  readonly value: string
}

/**
 * Return literal copy embedded in the expression forms normally used to compose UI text.
 * This stays deliberately narrower than a descendant walk: property keys, semantic arguments,
 * and implementation strings inside unrelated calls are not presentation surfaces.
 */
function literalParts(node: ts.Node | undefined): LiteralPart[] {
  if (node === undefined) return []
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [{ node, value: node.text }]
  }
  if (ts.isTemplateExpression(node)) {
    return [
      { node: node.head, value: node.head.text },
      ...node.templateSpans.map((span) => ({ node: span.literal, value: span.literal.text })),
    ]
  }
  if (ts.isJsxExpression(node)) return literalParts(node.expression)
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return literalParts(node.expression)
  }
  if (ts.isConditionalExpression(node)) {
    return [...literalParts(node.whenTrue), ...literalParts(node.whenFalse)]
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind
    if (
      operator === ts.SyntaxKind.PlusToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [...literalParts(node.left), ...literalParts(node.right)]
    }
    return []
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(literalParts)
  return []
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
    // Delimiters used to combine already-owned dynamic values are formatting, not copy.
    if (!/[\p{L}\p{N}\p{S}]/u.test(value)) return
    findings.push({
      file,
      line: lineOf(source, node),
      message: `${surface} contains learner-facing literal ${JSON.stringify(value)}; use src/lib/copy.ts`,
    })
  }

  const reportLiterals = (node: ts.Node | undefined, surface: string): void => {
    for (const part of literalParts(node)) report(part.node, surface, part.value)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.getText(source).trim()
      if (text.length > 0) report(node, 'JSX text', text)
    } else if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      reportLiterals(node, 'JSX text expression')
    } else if (ts.isJsxAttribute(node) && COPY_PROPS.has(node.name.getText(source))) {
      reportLiterals(node.initializer, `JSX ${node.name.getText(source)} prop`)
    } else if (ts.isCallExpression(node) && callName(node.expression) === 'showToast') {
      reportLiterals(node.arguments[0], 'showToast message')
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
