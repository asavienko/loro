import type { CredentialVault } from './client'
// Browser refresh credentials deliberately have page lifetime; no token in Web Storage/SQLite.
let credential: string | null = null
export const credentialVault: CredentialVault = {
  read: () => Promise.resolve(credential),
  write: (value) => {
    credential = value
    return Promise.resolve()
  },
  clear: () => {
    credential = null
    return Promise.resolve()
  },
}
