/**
 * Loro API.
 *
 * Four jobs, and none of them is running a practice session: arbitrate sync,
 * distribute content, proxy AI and TTS, verify purchases. A learner can practise for
 * weeks with this unreachable — see docs/architecture/overview.md rule 2.
 */

import { loadEnvFile } from 'node:process'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { config } from './common/config.js'
import { configureHttpApp } from './http-app.js'
import { mergeAvailable } from './sync/merge.js'
import { DATABASE, type SqlDatabase } from './database/database.js'
import { authSettings, isLoopbackHttpUrl } from './auth/settings.js'

async function bootstrap(): Promise<void> {
  try {
    loadEnvFile(new URL('../.env', import.meta.url))
  } catch {
    /* Compose already injects the environment; the host file is optional. */
  }
  // Refuse to start in production without the shared merge. Serving sync with a
  // half-built image is worse than not serving it: pushes would fail one by one while
  // the process looked healthy. In development this is a warning, because most work
  // here doesn't touch sync and requiring a Rust toolchain to run the API would be a
  // tax on everyone.
  if (!mergeAvailable()) {
    const msg = 'loro-core WASM is missing — build it with `pnpm core-rs:build`'
    if (config.isProduction()) throw new Error(msg)
    new Logger('bootstrap').warn(`${msg}. /v1/sync will return 500 and readiness is degraded.`)
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  })
  app.enableShutdownHooks()
  const oauth = authSettings()
  const redirectOrigins = (oauth?.redirects ?? [])
    .filter((uri) => {
      try {
        const url = new URL(uri)
        return url.protocol === 'https:' || isLoopbackHttpUrl(url)
      } catch {
        return false
      }
    })
    .map((uri) => new URL(uri).origin)
  app.enableCors({
    origin: [...new Set([...config.allowedOrigins(), ...redirectOrigins])],
    methods: ['GET', 'POST'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Loro-Device',
      'X-Loro-App',
      'Idempotency-Key',
    ],
    credentials: false,
    exposedHeaders: ['Retry-After'],
  })

  configureHttpApp(app)
  if ((config.isProduction() && Boolean(config.databaseUrl())) || oauth) {
    if (!(await app.get<SqlDatabase>(DATABASE).ready())) {
      await app.close()
      throw new Error('Durable database is unavailable')
    }
  }

  const port = config.port()
  await app.listen(port, '0.0.0.0')

  const logger = new Logger('bootstrap')
  logger.log(`loro api listening on :${port}/v1`)
  // Read through the same accessor the service uses, so the banner cannot name a
  // provider the service isn't actually running.
  logger.log(`AI provider: ${config.aiProvider()}`)
  logger.log(`TTS provider: ${config.ttsProvider()}`)
}

void bootstrap()
