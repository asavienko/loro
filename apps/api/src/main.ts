/**
 * Loro API.
 *
 * Four jobs, and none of them is running a practice session: arbitrate sync,
 * distribute content, proxy AI and TTS, verify purchases. A learner can practise for
 * weeks with this unreachable — see docs/architecture/overview.md rule 2.
 */

import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './common/problem-filter.js'
import { mergeAvailable } from './sync/merge.js'

async function bootstrap(): Promise<void> {
  // Refuse to start in production without the shared merge. Serving sync with a
  // half-built image is worse than not serving it: pushes would fail one by one while
  // the process looked healthy. In development this is a warning, because most work
  // here doesn't touch sync and requiring a Rust toolchain to run the API would be a
  // tax on everyone.
  if (!mergeAvailable()) {
    const msg = 'loro-core WASM is missing — build it with `pnpm core-rs:build`'
    if (process.env['NODE_ENV'] === 'production') throw new Error(msg)
    new Logger('bootstrap').warn(`${msg}. /v1/sync will return 500 and readiness is degraded.`)
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: false })

  app.setGlobalPrefix('v1')
  // Request validation is explicit in the controllers, using the Zod schemas shared
  // with the client (packages/core). That keeps ONE definition of the contract and
  // avoids a second, decorator-based one that could drift from it.
  //
  // RFC 9457 for every error. Never a stack trace, never SQL text.
  app.useGlobalFilters(new ProblemDetailsFilter())

  const port = Number(process.env['PORT'] ?? 3000)
  await app.listen(port, '0.0.0.0')

  const logger = new Logger('bootstrap')
  logger.log(`loro api listening on :${port}/v1`)
  logger.log(`AI provider: ${process.env['AI_PROVIDER'] ?? 'stub'}`)
}

void bootstrap()
