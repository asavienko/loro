import type { SqlDriver } from '@loro/core'
export async function openDeviceSqlite(): Promise<SqlDriver> {
  // NativeModules is read by op-sqlite on import. Keep it within bootstrap recovery.
  const { openDeviceSqlite: openNativeDatabase } = await import('./driver.opsqlite')
  return openNativeDatabase()
}
