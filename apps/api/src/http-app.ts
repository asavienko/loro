/**
 * Shared HTTP surface for production boot and full-module tests.
 *
 * Body limits, the `/v1` prefix and the RFC 9457 filter used to be copied into
 * every Nest test. One helper keeps those in step with `main.ts`.
 */

import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ProblemDetailsFilter } from './common/problem-filter.js'

export const JSON_BODY_LIMIT = '1mb'
export const FORM_BODY_LIMIT = '32kb'

export function configureHttpApp(app: INestApplication): INestApplication {
  const express = app as NestExpressApplication
  express.useBodyParser('json', { limit: JSON_BODY_LIMIT })
  express.useBodyParser('urlencoded', { extended: false, limit: FORM_BODY_LIMIT })
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new ProblemDetailsFilter())
  return app
}
