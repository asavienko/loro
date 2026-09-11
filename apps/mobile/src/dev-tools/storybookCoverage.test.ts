import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTION_COMPONENT_NAMES } from './specimenContract'

function storyFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return storyFiles(path)
    return entry.name.endsWith('.stories.tsx') ? [path] : []
  })
}

describe('storybook coverage', () => {
  it('registers a CSF title for every production component', () => {
    const root = join(import.meta.dirname, '../../.storybook/stories')
    const titles = storyFiles(root).map((file) => {
      const match = /title:\s*'([^']+)'/.exec(readFileSync(file, 'utf8'))
      if (match?.[1] === undefined) throw new Error(`missing CSF title in ${file}`)
      const name = match[1].split('/').at(-1)
      if (name === undefined) throw new Error(`empty CSF title in ${file}`)
      return name
    })
    expect([...titles].sort()).toEqual([...PRODUCTION_COMPONENT_NAMES].sort())
    expect(new Set(titles).size).toBe(PRODUCTION_COMPONENT_NAMES.length)
  })
})
