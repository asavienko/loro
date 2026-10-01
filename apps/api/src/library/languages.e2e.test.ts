/** Plan 108: the app reads the languages it offers from the API, versioned like a pack. */
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { V2_LANGUAGES } from '@loro/content/v2'
import { LIBRARY_COURSES } from '@loro/core/api/library'
import { createTestApp } from '../testing/create-test-app.js'

describe('GET /v1/library/languages', () => {
  let app: INestApplication
  let base: string

  beforeAll(async () => {
    // No database behind it: the languages come from the content, not the seed.
    const started = await createTestApp()
    app = started.app
    base = started.base
  })

  afterAll(async () => {
    await app.close()
  })

  it('lists every language, which a course teaches and which the app speaks, signed out', async () => {
    const response = await fetch(`${base}/v1/library/languages`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = (await response.json()) as {
      version: string
      languages: { code: string; flag: string; uiLocale: string | null; canTarget: boolean }[]
    }
    expect(body.version).toMatch(/^[0-9a-f]{16}$/)
    expect(body.languages).toEqual(V2_LANGUAGES)
    expect(body.languages.filter((l) => l.canTarget).map((l) => l.code)).toEqual([
      ...LIBRARY_COURSES,
    ])
    // The same languages answer the same version.
    const again = (await (await fetch(`${base}/v1/library/languages`)).json()) as {
      version: string
    }
    expect(again.version).toBe(body.version)
  })
})
