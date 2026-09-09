import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const DEFAULT_JOB_LIMIT = 2
export const TERMINATION_GRACE_MS = 2_000

export function isPathInside(root, path) {
  const rel = relative(root, path)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))
}

export function parsePositiveInteger(value, name, fallback) {
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer; got ${value}`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer; got ${value}`)
  return parsed
}

export function relativePath(root, path) {
  return relative(root, path).split('/').join('/')
}
