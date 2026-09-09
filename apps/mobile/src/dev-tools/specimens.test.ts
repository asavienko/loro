import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  PENDING_NAVIGATION_SPECIMENS,
  PLAN_80_PENDING_NAVIGATION,
  PRODUCTION_COMPONENT_NAMES,
  SPECIMEN_STATE_MATRIX,
} from './specimenContract'

function sourceFiles(root: URL): URL[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name, root)
    if (entry.isDirectory()) return sourceFiles(new URL(`${entry.name}/`, root))
    return /(?<!\.test)\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function exportedValueNames(source: ts.SourceFile): string[] {
  return source.statements.flatMap((statement) => {
    const exported =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      return exported && statement.name && /^[A-Z]/.test(statement.name.text)
        ? [statement.name.text]
        : []
    if (ts.isVariableStatement(statement) && exported)
      return statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) && /^[A-Z]/.test(declaration.name.text)
          ? [declaration.name.text]
          : [],
      )
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause)
      return ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.flatMap((entry) =>
            entry.isTypeOnly || !/^[A-Z]/.test(entry.name.text) ? [] : [entry.name.text],
          )
        : []
    return []
  })
}

function productionExportNames(): string[] {
  return ['primitives', 'components'].flatMap((directory) => {
    const root = new URL(`../ui/${directory}/`, import.meta.url)
    return sourceFiles(root).flatMap((file) =>
      exportedValueNames(
        ts.createSourceFile(
          join(directory, file.pathname),
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
          file.pathname.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
      ),
    )
  })
}

describe('production specimen registry', () => {
  it('DEV-SPECIMENS-01 registers every production component name once', () => {
    expect(new Set(PRODUCTION_COMPONENT_NAMES).size).toBe(PRODUCTION_COMPONENT_NAMES.length)
    // Scan recursively and include named/aliased barrel exports as well as direct declarations.
    expect([...new Set(productionExportNames())].sort()).toEqual(
      [...PRODUCTION_COMPONENT_NAMES].sort(),
    )
  })

  it('DEV-SPECIMENS-02 explicitly classifies every required state', () => {
    expect(new Set(SPECIMEN_STATE_MATRIX.map((state) => state.id)).size).toBe(
      SPECIMEN_STATE_MATRIX.length,
    )
    expect(SPECIMEN_STATE_MATRIX.find((state) => state.id === 'loading')).toEqual({
      id: 'loading',
      status: 'available',
    })
    expect(SPECIMEN_STATE_MATRIX.find((state) => state.id === 'pressed-focused')).toEqual({
      id: 'pressed-focused',
      status: 'available',
    })
  })

  it('DEV-SPECIMENS-03 reports the exact plan-80 navigation entries as pending plan 81', () => {
    expect(PENDING_NAVIGATION_SPECIMENS.map((entry) => entry.name)).toEqual([
      'Spine',
      'ScreenHeader',
      'SwitcherSheet',
      'ExitSheet',
      'ResumeStrip',
      'TransportStrip',
    ])
    expect(PENDING_NAVIGATION_SPECIMENS.map((entry) => entry.status)).toEqual(
      PLAN_80_PENDING_NAVIGATION.map(() => 'pending-plan-81'),
    )
    expect(PENDING_NAVIGATION_SPECIMENS).toHaveLength(PLAN_80_PENDING_NAVIGATION.length)
  })
})
