export type PersistenceStatus = 'opening' | 'ready' | 'error'

/** A write failure must not unmount an in-progress learner draft while recovery retries. */
export function shouldKeepMountedRoutes(status: PersistenceStatus, hasBeenReady: boolean): boolean {
  return status === 'ready' || hasBeenReady
}
