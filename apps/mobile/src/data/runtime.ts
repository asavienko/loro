import { migrate, openSqlPersistence } from '@loro/core'
import { deviceClock } from '../lib/clock'
import { newId } from '../lib/ids'
import { nextHlc } from '../lib/core'
import { openDeviceSqlite } from './driver'
import { readLocalValue, writeLocalValue, type RuntimeDatabase } from './database'
import { flushPendingDeletes } from './pendingDeletes'

let opening: Promise<RuntimeDatabase> | null = null

export function getRuntimeDatabase(): Promise<RuntimeDatabase> {
  opening ??= Promise.resolve()
    .then(async () => {
      const driver = await openDeviceSqlite()
      try {
        migrate(driver, deviceClock.now())
        const deviceId = readLocalValue(driver, 'device_id') ?? newId()
        driver.transaction(() => {
          writeLocalValue(driver, 'device_id', deviceId)
        })
        const hlc = (): string => {
          const stamp = nextHlc(deviceClock.now(), readLocalValue(driver, 'last_hlc'), deviceId)
          writeLocalValue(driver, 'last_hlc', stamp)
          return stamp
        }
        const database = {
          driver,
          deviceId,
          hlc,
          persistence: openSqlPersistence(driver, hlc, deviceClock.now()),
        }
        flushPendingDeletes(database, deviceClock.now())
        return database
      } catch (error) {
        driver.close()
        throw error
      }
    })
    .catch((error: unknown) => {
      opening = null
      throw error
    })
  return opening
}
