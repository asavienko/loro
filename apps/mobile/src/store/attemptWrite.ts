import { isPersistenceWriteError } from './store'

/** The global alert reports failed local writes; callers retain their draft and route. */
export function attemptWrite(write: () => void): boolean {
  try {
    write()
    return true
  } catch (error) {
    if (!isPersistenceWriteError(error)) throw error
    return false
  }
}
