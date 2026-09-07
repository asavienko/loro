import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  sql: vi.fn(),
  call: vi.fn(),
  close: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  uuid: vi.fn(() => 'installation-uuid'),
}))
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }))
vi.mock('@loro/core', () => ({ openSqlPersistence: mocks.sql }))
vi.mock('../core/loader', () => ({ getCore: () => ({ coreCall: mocks.call }) }))
vi.mock('./driver.opsqlite.native', () => ({ openOpSqlite: mocks.open }))

describe('native runtime repository lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.get.mockReturnValue(null)
    mocks.open.mockReturnValue({ close: mocks.close })
    mocks.sql.mockImplementation(() => ({
      metadata: { get: mocks.get, set: mocks.set },
      transaction: (fn: () => void) => {
        fn()
      },
    }))
  })
  it('closes a failed migration handle and retries without a memory fallback', async () => {
    mocks.sql.mockImplementationOnce(() => {
      throw new Error('migration failed')
    })
    const { openRuntimePersistence } = await import('./openRuntimePersistence.native')
    await expect(openRuntimePersistence()).rejects.toThrow('migration failed')
    expect(mocks.close).toHaveBeenCalledOnce()
    const repository = await openRuntimePersistence()
    expect(await openRuntimePersistence()).toBe(repository)
    expect(mocks.open).toHaveBeenCalledTimes(2)
  })
  it('shares an in-flight open between callers', async () => {
    const { openRuntimePersistence } = await import('./openRuntimePersistence.native')
    const first = openRuntimePersistence()
    expect(openRuntimePersistence()).toBe(first)
    await first
    expect(mocks.open).toHaveBeenCalledOnce()
  })
  it('reuses the installation identity and forwards the last persisted HLC to Rust', async () => {
    mocks.get.mockReturnValue('existing-device')
    mocks.call.mockReturnValue({ physical: 100, logical: 9, node_id: 'existing-device' })
    const { openRuntimePersistence } = await import('./openRuntimePersistence.native')
    await openRuntimePersistence()
    const tick = mocks.sql.mock.calls[0]?.[1] as (last: string | null) => string
    expect(tick('100:0008:existing-device')).toBe('100:0009:existing-device')
    expect(mocks.call).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'hlc_tick',
        node_id: 'existing-device',
        last: { physical: 100, logical: 8, node_id: 'existing-device' },
      }),
    )
    expect(mocks.uuid).not.toHaveBeenCalled()
    expect(() => tick(':0008:existing-device')).toThrow('Invalid persisted clock')
    expect(() => tick('100:-1:existing-device')).toThrow('Invalid persisted clock')
  })
})
