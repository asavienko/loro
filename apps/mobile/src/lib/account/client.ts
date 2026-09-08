import {
  MagicLinkRequestSchema,
  MagicLinkResponseSchema,
  MagicVerifyRequestSchema,
  SignInResponseSchema,
  TokenResponseSchema,
  type DeviceRegistration,
  type SignInResponse,
} from '@loro/core/api/target'

export interface CredentialVault {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  clear(): Promise<void>
}
export interface AccountSession {
  accountId: string
  deviceId: string
}
export type AccountStatus = 'signed-out' | 'working' | 'code-sent' | 'signed-in' | 'error'
export type AccountErrorCode =
  'unconfigured' | 'network' | 'invalid-code' | 'unavailable' | 'account-mismatch' | 'storage'
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
interface Dependencies {
  baseUrl: string | null
  device: DeviceRegistration
  anonId: string
  vault: CredentialVault
  now(): number
  bindAccount(accountId: string): void
  isOnline?(): Promise<boolean>
  fetch?: typeof globalThis.fetch
}
interface SavedCredential extends AccountSession {
  installationId: string
  refreshToken: string
}
function readCredential(raw: string): SavedCredential | null {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null) return null
  if (
    !('accountId' in value) ||
    typeof value.accountId !== 'string' ||
    !('deviceId' in value) ||
    typeof value.deviceId !== 'string' ||
    !('installationId' in value) ||
    typeof value.installationId !== 'string' ||
    !('refreshToken' in value) ||
    typeof value.refreshToken !== 'string'
  )
    return null
  return {
    accountId: value.accountId,
    deviceId: value.deviceId,
    installationId: value.installationId,
    refreshToken: value.refreshToken,
  }
}

/** F-01/F-02. Credentials never enter progress storage; refresh is single-flight and never replayed. */
export class AccountClient {
  private state: AccountState = { status: 'signed-out', session: null, error: null }
  private listeners = new Set<() => void>()
  private accessToken: string | null = null
  private expiresAt = 0
  private credential: SavedCredential | null = null
  private generation = 0
  private refreshFlight: Promise<string | null> | null = null
  private vaultWrites: Promise<void> = Promise.resolve()
  constructor(private readonly deps: Dependencies) {}
  get configured(): boolean {
    return this.deps.baseUrl !== null
  }
  getSnapshot = (): AccountState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<AccountState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private save(write: () => Promise<void>): Promise<void> {
    const operation = this.vaultWrites.then(write, write)
    this.vaultWrites = operation.catch(() => undefined)
    return operation
  }
  private async post(
    path: string,
    body: unknown,
    bearer?: { token: string; deviceId: string },
  ): Promise<unknown> {
    if (!this.deps.baseUrl) throw new AccountError('unconfigured')
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 15_000)
    try {
      const response = await (this.deps.fetch ?? globalThis.fetch)(`${this.deps.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loro-App': '0.0.0+1',
          ...(bearer
            ? { Authorization: `Bearer ${bearer.token}`, 'X-Loro-Device': bearer.deviceId }
            : {}),
        },
        body: JSON.stringify(body),
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!response.ok)
        throw new AccountError(
          response.status === 401 || response.status === 400 || response.status === 422
            ? 'invalid-code'
            : 'unavailable',
        )
      if (response.status === 204) return null
      const text = await response.text()
      if (text.length > 32_768) throw new AccountError('unavailable')
      return JSON.parse(text) as unknown
    } catch (error) {
      if (error instanceof AccountError) throw error
      throw new AccountError('network')
    } finally {
      clearTimeout(timeout)
    }
  }
  private fail(error: unknown): void {
    this.publish({
      status: 'error',
      error: error instanceof AccountError ? error.code : 'unavailable',
    })
  }
  async restore(): Promise<void> {
    const generation = this.generation
    try {
      const raw = await this.deps.vault.read()
      if (generation !== this.generation || !raw) return
      const saved = readCredential(raw)
      if (saved?.installationId !== this.deps.device.installation_id) {
        await this.save(() => this.deps.vault.clear())
        return
      }
      this.deps.bindAccount(saved.accountId)
      this.credential = saved
      // The verified binding is retained offline; sync asks for a fresh access token when online.
      this.publish({
        session: { accountId: saved.accountId, deviceId: saved.deviceId },
        status: 'signed-in',
      })
    } catch {
      if (generation === this.generation) this.fail(new AccountError('storage'))
    }
  }
  async requestCode(email: string): Promise<void> {
    const generation = ++this.generation
    this.publish({ status: 'working', error: null })
    try {
      MagicLinkResponseSchema.parse(
        await this.post('/auth/magic-link', MagicLinkRequestSchema.parse({ email: email.trim() })),
      )
      if (generation === this.generation) this.publish({ status: 'code-sent' })
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }
  async verifyCode(email: string, code: string): Promise<void> {
    const generation = ++this.generation
    this.publish({ status: 'working', error: null })
    try {
      const request = MagicVerifyRequestSchema.parse({
        email: email.trim(),
        code: code.trim(),
        anon_id: this.deps.anonId,
        device: this.deps.device,
      })
      const response = SignInResponseSchema.parse(
        await this.post('/auth/magic-link/verify', request),
      )
      if (generation !== this.generation) return
      await this.accept(response, generation)
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }
  private async accept(response: SignInResponse, generation: number): Promise<void> {
    try {
      this.deps.bindAccount(response.user.id)
    } catch {
      throw new AccountError('account-mismatch')
    }
    const saved: SavedCredential = {
      accountId: response.user.id,
      deviceId: response.device_id,
      installationId: this.deps.device.installation_id,
      refreshToken: response.refresh_token,
    }
    try {
      await this.save(() => this.deps.vault.write(JSON.stringify(saved)))
    } catch {
      throw new AccountError('storage')
    }
    if (generation !== this.generation) return
    this.credential = saved
    this.accessToken = response.access_token
    this.expiresAt = this.deps.now() + response.expires_in * 1000
    this.publish({
      status: 'signed-in',
      error: null,
      session: { accountId: saved.accountId, deviceId: saved.deviceId },
    })
  }
  getAccessToken = (): Promise<string | null> => {
    if (this.accessToken && this.deps.now() < this.expiresAt - 30_000)
      return Promise.resolve(this.accessToken)
    if (this.refreshFlight) return this.refreshFlight
    const flight = this.refresh()
    this.refreshFlight = flight
    void flight.finally(() => {
      if (this.refreshFlight === flight) this.refreshFlight = null
    })
    return flight
  }
  private async refresh(): Promise<string | null> {
    const saved = this.credential
    if (!saved) return null
    const generation = this.generation
    try {
      if (this.deps.isOnline && !(await this.deps.isOnline())) return null
      if (generation !== this.generation) return null
      this.credential = null
      // A timeout could mean the server consumed the token. Never retry it on restart.
      await this.save(() => this.deps.vault.clear())
      if (generation !== this.generation) return null
      const response = TokenResponseSchema.parse(
        await this.post('/auth/refresh', { refresh_token: saved.refreshToken }),
      )
      if (generation !== this.generation) return null
      const replacement = { ...saved, refreshToken: response.refresh_token }
      await this.save(() => this.deps.vault.write(JSON.stringify(replacement)))
      if (generation !== this.generation) return null
      this.credential = replacement
      this.accessToken = response.access_token
      this.expiresAt = this.deps.now() + response.expires_in * 1000
      this.publish({ status: 'signed-in', error: null })
      return this.accessToken
    } catch (error) {
      if (generation === this.generation) {
        this.accessToken = null
        this.publish({ session: null })
        this.fail(error)
      }
      return null
    }
  }
  async signOut(): Promise<void> {
    const token = this.accessToken
    const session = this.state.session
    this.generation += 1
    this.accessToken = null
    this.credential = null
    this.publish({ status: 'signed-out', session: null, error: null })
    try {
      await this.save(() => this.deps.vault.clear())
    } catch {
      this.fail(new AccountError('storage'))
    }
    if (token && session) {
      try {
        await this.post('/auth/logout', {}, { token, deviceId: session.deviceId })
      } catch {
        /* Local sign-out remains available offline; server revocation needs connectivity. */
      }
    }
  }
}
