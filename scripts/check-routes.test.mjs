import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { checkRoutes, discoverLearnerRoutes, routeOwnershipErrors } from './check-routes.mjs'

const surfaces = [
  { id: 'today', path: '/', availability: 'built' },
  { id: 'chat', path: '/chat', availability: 'planned' },
]
const states = [{ name: 'today', route: '/', spec: '§11 Today' }]

test('the actual route registry, files and expanded state manifest agree', () => {
  assert.deepEqual(checkRoutes(), [])
})

test('planned surfaces may stay declared without becoming reachable', () => {
  assert.deepEqual(routeOwnershipErrors(surfaces, ['/'], states), [])
  assert.ok(
    routeOwnershipErrors(surfaces, ['/', '/chat'], states).includes(
      'Unbuilt surface has a reachable screen: /chat',
    ),
  )
})

test('new and deleted screens cannot evade registry and state ownership', () => {
  const errors = routeOwnershipErrors(surfaces, ['/new'], states)
  assert.ok(errors.includes('Built surface has no screen: /'))
  assert.ok(errors.includes('Screen has no declared surface: /new'))
  assert.ok(errors.includes('Screen has no learner-state owner: /new'))
  assert.ok(errors.includes('State has no screen: today (/)'))
})

test('duplicate surfaces, routes and states and missing spec owners fail', () => {
  const errors = routeOwnershipErrors(
    [...surfaces, surfaces[0]],
    ['/', '/'],
    [...states, { ...states[0], spec: ' ' }],
  )
  for (const error of [
    'Duplicate surface id: today',
    'Duplicate surface path: /',
    'Duplicate screen route: /',
    'Duplicate state name: today',
    'State has no specification owner: today',
  ])
    assert.ok(errors.includes(error), error)
})

test('discovery normalizes groups and index routes and excludes only infrastructure and dev', () => {
  const directory = mkdtempSync(join(tmpdir(), 'loro-routes-'))
  try {
    for (const file of [
      'index.tsx',
      '_layout.tsx',
      '_add/ImportPhrases.tsx',
      'practice/_emptyPractice.tsx',
      '+not-found.tsx',
      'dev/tokens.tsx',
      '(learner)/phrase/[id].tsx',
      '(learner)/settings/index.tsx',
      'device.tsx',
    ]) {
      mkdirSync(join(directory, file, '..'), { recursive: true })
      writeFileSync(join(directory, file), '')
    }
    assert.deepEqual(discoverLearnerRoutes(directory), [
      '/',
      '/device',
      '/phrase/[id]',
      '/settings',
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
