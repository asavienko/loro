import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  core: vi.fn(),
  open: vi.fn(),
  hydrate: vi.fn(),
  adapter: vi.fn(),
  store: {},
}))
vi.mock('./coreFacade', () => ({ canonicalCoreFacade: {} }))
vi.mock('../core/loader', () => ({ loadCore: mocks.core }))
vi.mock('../data/openRuntimePersistence', () => ({ openRuntimePersistence: mocks.open }))
vi.mock('../data/runtimePersistence', () => ({ createRuntimePersistence: mocks.adapter }))
vi.mock('./store', () => ({ initializeStorePersistence: mocks.hydrate, useApp: mocks.store }))

describe('learning runtime initialization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.stubGlobal('__DEV__', false)
    mocks.core.mockResolvedValue({})
    mocks.open.mockResolvedValue({})
    mocks.adapter.mockReturnValue({})
  })
  it('waits for canonical core before opening storage and hydrating the store', async () => {
    let release!: () => void
    mocks.core.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const { startLearningRuntime } = await import('./bootstrap')
    const first = startLearningRuntime()
    expect(startLearningRuntime()).toBe(first)
    await Promise.resolve()
    expect(mocks.open).not.toHaveBeenCalled()
    release()
    await first
    expect(mocks.hydrate).toHaveBeenCalledOnce()
    await startLearningRuntime()
    expect(mocks.open).toHaveBeenCalledOnce()
  })
  it('does not hydrate after an open failure and retries the real storage operation', async () => {
    mocks.open.mockRejectedValueOnce(new Error('migration failed'))
    const { startLearningRuntime } = await import('./bootstrap')
    await startLearningRuntime()
    expect(mocks.hydrate).not.toHaveBeenCalled()
    await startLearningRuntime()
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(mocks.hydrate).toHaveBeenCalledOnce()
  })
  it('does not declare hydration failures ready', async () => {
    mocks.hydrate.mockImplementationOnce(() => {
      throw new Error('unreadable local data')
    })
    const { startLearningRuntime } = await import('./bootstrap')
    await startLearningRuntime()
    await startLearningRuntime()
    expect(mocks.hydrate).toHaveBeenCalledTimes(2)
  })
})
