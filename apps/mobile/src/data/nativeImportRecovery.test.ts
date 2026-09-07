import { expect, it, vi } from 'vitest'

vi.mock('expo-crypto', () => ({ randomUUID: () => 'device' }))
vi.mock('../core/loader', () => ({ getCore: vi.fn() }))
vi.mock('@loro/core', () => ({
  openSqlPersistence: () => ({
    transaction: (fn: () => void) => {
      fn()
    },
    metadata: { get: () => 'device', set: vi.fn() },
  }),
}))

it('a missing native driver rejects inside startup and permits a subsequent retry', async () => {
  vi.doMock('./driver.opsqlite.native', () => {
    throw new Error('Native module unavailable')
  })
  const { openRuntimePersistence } = await import('./openRuntimePersistence.native')
  await expect(openRuntimePersistence()).rejects.toThrow()
  const close = vi.fn()
  vi.doMock('./driver.opsqlite.native', () => ({ openOpSqlite: () => ({ close }) }))
  await expect(openRuntimePersistence()).resolves.toHaveProperty('metadata')
  expect(close).not.toHaveBeenCalled()
})
