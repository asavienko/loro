import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing'
import { AppModule } from '../app.module.js'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { DATABASE } from '../database/database.js'
import { configureHttpApp } from '../http-app.js'
import { InMemorySyncRepository } from '../sync/testing/sync.repository.memory.js'
import { SYNC_REPOSITORY } from '../sync/sync.repository.js'

export interface TestApp {
  app: INestApplication
  base: string
  module: TestingModule
}

const defaultPrincipal = {
  userId: 'contract-learner',
  deviceId: 'contract-device',
  sessionId: 'contract-session',
}

export function withTestPrincipal(
  builder: TestingModuleBuilder,
  principal: AuthenticatedRequest['principal'] = defaultPrincipal,
): TestingModuleBuilder {
  return builder.overrideGuard(AuthGuard).useValue({
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
      request.principal = principal
      return true
    },
  })
}

/** In-memory adapters for HTTP tests that do not own a real database. */
export function testingModule(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): TestingModuleBuilder {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue({ ready: () => Promise.resolve(true) })
    .overrideProvider(SYNC_REPOSITORY)
    .useValue(new InMemorySyncRepository())
  if (configure) builder = configure(builder)
  return builder
}

export async function listenTestApp(module: TestingModule): Promise<TestApp> {
  const app = configureHttpApp(module.createNestApplication({ bodyParser: false }))
  await app.listen(0, '127.0.0.1')
  return { app, base: await app.getUrl(), module }
}

export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestApp> {
  return listenTestApp(await testingModule(configure).compile())
}
