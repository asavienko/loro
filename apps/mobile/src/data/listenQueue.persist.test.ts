import { afterEach, describe, expect, it } from 'vitest'
import {
  LOCAL_USER_ID,
  buildListenQueue,
  clearListenQueue,
  loadListenQueue,
  openSqlPersistence,
  saveListenQueue,
  type SqlDriver,
} from '@loro/core'
import { openNodeSqlite } from './driver.node'

const T0 = 1_785_231_660_000
const drivers: SqlDriver[] = []

afterEach(() => {
  for (const driver of drivers.splice(0)) {
    try {
      driver.close()
    } catch {
      /* already closed */
    }
  }
})

function open(): SqlDriver {
  const driver = openNodeSqlite()
  drivers.push(driver)
  openSqlPersistence(driver, () => `${String(T0)}:0:test`, T0)
  return driver
}

describe('listen queue real SQLite persist', () => {
  it('upserts owned columns with ON CONFLICT and decodes fail-closed', () => {
    const driver = open()
    const payload = buildListenQueue({
      targetLocale: 'es-ES',
      phraseIds: ['alpha', 'beta'],
    })
    if (payload === null) throw new Error('expected a listen queue')
    expect(loadListenQueue(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
    saveListenQueue(driver, LOCAL_USER_ID, payload)
    expect(loadListenQueue(driver, LOCAL_USER_ID, 'es-ES')).toEqual(payload)
    saveListenQueue(driver, LOCAL_USER_ID, { ...payload, phraseIds: ['beta', 'alpha'] })
    expect(loadListenQueue(driver, LOCAL_USER_ID, 'es-ES')?.phraseIds).toEqual(['beta', 'alpha'])
    driver.run('UPDATE local_metadata SET value = ? WHERE key = ?', ['{', 'listen_queue:es-ES'])
    expect(loadListenQueue(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
    saveListenQueue(driver, LOCAL_USER_ID, payload)
    clearListenQueue(driver, LOCAL_USER_ID, 'es-ES')
    expect(loadListenQueue(driver, LOCAL_USER_ID, 'es-ES')).toBeNull()
  })
})
