import { readdirSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  PENDING_NAVIGATION_SPECIMENS,
  PLAN_80_PENDING_NAVIGATION,
  PRODUCTION_COMPONENT_NAMES,
  SPECIMEN_STATE_MATRIX,
} from './specimenContract'

describe('production specimen registry', () => {
  it('DEV-SPECIMENS-01 registers every production component name once', () => {
    expect(new Set(PRODUCTION_COMPONENT_NAMES).size).toBe(PRODUCTION_COMPONENT_NAMES.length)
    // Scan definitions as well as barrels: directly imported components must not disappear.
    const exportedNames = ['primitives', 'components'].flatMap((directory) => {
      const root = new URL(`../ui/${directory}/`, import.meta.url)
      return readdirSync(root)
        .filter((name) => name.endsWith('.tsx'))
        .flatMap((name) => {
          const source = ts.createSourceFile(
            name,
            readFileSync(new URL(name, root), 'utf8'),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX,
          )
          return source.statements.flatMap((statement) => {
            if (
              !ts.canHaveModifiers(statement) ||
              !ts
                .getModifiers(statement)
                ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
            )
              return []
            if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
              return statement.name && /^[A-Z]/.test(statement.name.text)
                ? [statement.name.text]
                : []
            }
            if (ts.isVariableStatement(statement))
              return statement.declarationList.declarations.flatMap((declaration) =>
                ts.isIdentifier(declaration.name) && /^[A-Z]/.test(declaration.name.text)
                  ? [declaration.name.text]
                  : [],
              )
            return []
          })
        })
    })
    expect(exportedNames.sort()).toEqual([...PRODUCTION_COMPONENT_NAMES].sort())
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
