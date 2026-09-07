import { randomUUID } from 'expo-crypto'
import { openSqlPersistence, type Persistence, type SqlDriver } from '@loro/core'
import { nextRuntimeHlc } from './runtimeHlc'
import { deviceClock } from '../lib/clock'

let opened: Persistence | undefined
let opening: Promise<Persistence> | undefined

/** Missing native modules and failed migrations reach the startup recovery screen. */
export function openRuntimePersistence(): Promise<Persistence> {
  if (opened) return Promise.resolve(opened)
  if (opening) return opening
  opening = (async () => {
    let driver: SqlDriver | undefined
    try {
      // op-sqlite reads NativeModules at import time: keep that work inside recovery.
      const { openOpSqlite } = await import('./driver.opsqlite.native')
      driver = openOpSqlite()
      let nodeId = ''
      const persistence = openSqlPersistence(
        driver,
        (previous) => nextRuntimeHlc(previous, nodeId),
        deviceClock.now(),
      )
      persistence.transaction(() => {
        nodeId = persistence.metadata.get('installation-id') ?? randomUUID()
        persistence.metadata.set('installation-id', nodeId)
      })
      opened = persistence
      return persistence
    } catch (error) {
      driver?.close()
      throw error
    } finally {
      opening = undefined
    }
  })()
  return opening
}
