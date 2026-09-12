import type { CredentialVault } from './client'

// Browser refresh credentials have page lifetime. Playwright sets `__LORO_E2E__` so a
// same-tab reload can restore the in-memory session without writing production Web Storage.
const E2E_KEY = 'loro.e2e.account.v1'
let credential: string | null = null

function e2eStore(): Storage | null {
  if (typeof window === 'undefined' || window.__LORO_E2E__ !== true) return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

export const credentialVault: CredentialVault = {
  read: () => {
    const stored = e2eStore()?.getItem(E2E_KEY)
    if (stored !== null && stored !== undefined) credential = stored
    return Promise.resolve(credential)
  },
  write: (value) => {
    credential = value
    e2eStore()?.setItem(E2E_KEY, value)
    return Promise.resolve()
  },
  clear: () => {
    credential = null
    e2eStore()?.removeItem(E2E_KEY)
    return Promise.resolve()
  },
}

declare global {
  interface Window {
    __LORO_E2E__?: boolean
  }
}
