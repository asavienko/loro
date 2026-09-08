import { openDeviceSqlite as openNativeDatabase } from './driver.opsqlite'
import type { SqlDriver } from '@loro/core'
export function openDeviceSqlite(): Promise<SqlDriver> {
  return Promise.resolve(openNativeDatabase())
}
