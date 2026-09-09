export interface CredentialVault {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  clear(): Promise<void>
  readLegacy?(): Promise<string | null>
  clearLegacy?(): Promise<void>
}

export interface AccountSession {
  accountId: string
  deviceId: string
}

export type AccountStatus =
  'signed-out' | 'working' | 'code-sent' | 'signed-in' | 'error' | 'cancelled'

export type AccountErrorCode =
  | 'unconfigured'
  | 'network'
  | 'invalid-code'
  | 'unavailable'
  | 'account-mismatch'
  | 'storage'
  | 'provider-error'
  | 'localSignOut'
  | 'upgrade-sign-in'
  | 'upgrade-offline'

export interface AccountState {
  status: AccountStatus
  session: AccountSession | null
  error: AccountErrorCode | null
}

export class AccountError extends Error {
  constructor(readonly code: AccountErrorCode) {
    super(code)
  }
}
