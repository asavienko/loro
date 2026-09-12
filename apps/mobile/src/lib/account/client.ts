import {
  MagicLinkRequestSchema,
  MagicLinkResponseSchema,
  MagicVerifyRequestSchema,
  SignInResponseSchema,
  TokenResponseSchema,
  type DeviceRegistration,
  type SignInResponse,
} from '@loro/core/api/account'
import type { OAuthProvider } from '@loro/core/api/oauth'
import { authorizeProvider, type AuthorizationPorts } from '../../auth/client'
import { readCredential, type SavedCredential } from './credentials'
import {
  AccountError,
  type AccountErrorCode,
  type AccountState,
  type CredentialVault,
} from './types'

export type {
  AccountErrorCode,
  AccountSession,
  AccountState,
  AccountStatus,
  CredentialVault,
} from './types'
export { AccountError } from './types'

interface Dependencies {
  baseUrl: string | null
  device: DeviceRegistration
  anonId: string
  vault: CredentialVault
  now(): number
  bindAccount(accountId: string): void
  isOnline?(): Promise<boolean>
  fetch?: typeof globalThis.fetch
  authorization?: AuthorizationPorts
}

type RequestKind = 'provider' | 'email-request' | 'email-verify' | 'refresh' | 'logout' | 'other'

function classifyResponse(status: number, kind: RequestKind): AccountErrorCode {
  if (status === 429) return 'rate-limited'
  if ((status === 400 || status === 422) && kind === 'email-request') return 'invalid-email'
  if ((status === 400 || status === 401 || status === 422) && kind === 'email-verify')
    return 'invalid-code'
  if ((status === 400 || status === 401 || status === 422) && kind === 'provider')
    return 'provider-error'
  return 'unavailable'
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
  private restoreFlight: Promise<void> | null = null
  private vaultWrites: Promise<void> = Promise.resolve()
  private attemptControllers = new Map<number, Set<AbortController>>()
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
    generation?: number,
    kind: RequestKind = 'other',
  ): Promise<unknown> {
    if (!this.deps.baseUrl) throw new AccountError('unconfigured')
    const controller = new AbortController()
    if (generation !== undefined) {
      const controllers = this.attemptControllers.get(generation) ?? new Set<AbortController>()
      controllers.add(controller)
      this.attemptControllers.set(generation, controllers)
    }
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
      if (!response.ok) throw new AccountError(classifyResponse(response.status, kind))
      if (response.status === 204) return null
      const text = await response.text()
      if (text.length > 32_768) throw new AccountError('unavailable')
      return JSON.parse(text) as unknown
    } catch (error) {
      if (error instanceof AccountError) throw error
      throw new AccountError('network')
    } finally {
      clearTimeout(timeout)
      if (generation !== undefined) {
        const controllers = this.attemptControllers.get(generation)
        controllers?.delete(controller)
        if (controllers?.size === 0) this.attemptControllers.delete(generation)
      }
    }
  }
  private abortAttempt(generation: number): void {
    for (const controller of this.attemptControllers.get(generation) ?? []) controller.abort()
    this.attemptControllers.delete(generation)
  }
  private fail(error: unknown): void {
    this.publish({
      status: 'error',
      error: error instanceof AccountError ? error.code : 'unavailable',
    })
  }
  async restore(): Promise<void> {
    this.restoreFlight ??= this.restoreSaved().finally(() => {
      this.restoreFlight = null
    })
    await this.restoreFlight
  }
  private async restoreSaved(): Promise<void> {
    const generation = this.generation
    try {
      const raw = await this.deps.vault.read()
      if (generation !== this.generation) return
      if (!raw) {
        await this.upgradeLegacy(generation)
        return
      }
      const saved = readCredential(raw)
      if (saved?.installationId !== this.deps.device.installation_id) {
        await this.save(() => this.deps.vault.clear())
        this.publish({ error: 'upgrade-sign-in' })
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
  private async upgradeLegacy(generation: number): Promise<void> {
    const legacy = await this.deps.vault.readLegacy?.()
    if (!legacy || generation !== this.generation) return
    if (!this.configured) {
      this.publish({ error: 'unconfigured' })
      return
    }
    if (this.deps.isOnline && !(await this.deps.isOnline())) {
      this.publish({ error: 'upgrade-offline' })
      return
    }
    // The old raw refresh token contains no trusted device/account binding. Upgrade
    // through server verification, then apply the same ownership gate as new sign-in.
    await this.save(() => this.deps.vault.clearLegacy?.() ?? Promise.resolve())
    if (generation !== this.generation) return
    try {
      const response = SignInResponseSchema.parse(
        await this.post('/auth/refresh', {
          refresh_token: legacy,
          device: this.deps.device,
          anon_id: this.deps.anonId,
        }),
      )
      if (generation === this.generation) await this.accept(response, generation)
    } catch (error) {
      if (generation === this.generation)
        this.fail(
          error instanceof AccountError && error.code === 'account-mismatch'
            ? error
            : new AccountError('upgrade-sign-in'),
        )
    }
  }
  async signIn(provider: OAuthProvider, windowName?: string): Promise<boolean> {
    if (this.restoreFlight) await this.restoreFlight
    if (this.refreshFlight || this.state.status === 'working') return false
    const generation = ++this.generation
    this.publish({ status: 'working', error: null })
    try {
      if (!this.deps.authorization) throw new AccountError('unconfigured')
      const exchange = await authorizeProvider(
        provider,
        {
          ...this.deps.authorization,
          request: (path, body) => this.post(path, body, undefined, generation, 'provider'),
          isCurrent: () => generation === this.generation,
        },
        windowName,
      )
      if (generation !== this.generation) return true
      if (!exchange) {
        this.publish({ status: 'cancelled' })
        return true
      }
      const response = SignInResponseSchema.parse(
        await this.post(
          '/auth/exchange',
          {
            ...exchange,
            device: this.deps.device,
            anon_id: this.deps.anonId,
          },
          undefined,
          generation,
          'provider',
        ),
      )
      if (generation === this.generation) await this.accept(response, generation)
    } catch (error) {
      if (generation === this.generation)
        this.fail(error instanceof AccountError ? error : new AccountError('provider-error'))
    }
    return true
  }

  /**
   * Cancel only the current sign-in attempt. This deliberately does not sign out an existing
   * session: a provider window is an in-flight operation, not an authenticated account state.
   * Generation invalidation makes late start/callback/exchange results inert.
   */
  cancelSignIn(): void {
    if (this.state.status !== 'working') return
    const generation = this.generation
    this.generation += 1
    this.abortAttempt(generation)
    this.publish({ status: 'cancelled', error: null })
  }
  async requestCode(email: string): Promise<void> {
    if (this.restoreFlight || this.refreshFlight || this.state.status === 'working') return
    const generation = ++this.generation
    this.publish({ status: 'working', error: null })
    try {
      const request = MagicLinkRequestSchema.safeParse({ email: email.trim() })
      if (!request.success) throw new AccountError('invalid-email')
      MagicLinkResponseSchema.parse(
        await this.post('/auth/magic-link', request.data, undefined, generation, 'email-request'),
      )
      if (generation === this.generation) this.publish({ status: 'code-sent' })
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }
  async verifyCode(email: string, code: string): Promise<void> {
    if (this.restoreFlight || this.refreshFlight || this.state.status === 'working') return
    const generation = ++this.generation
    this.publish({ status: 'working', error: null })
    try {
      const request = MagicVerifyRequestSchema.safeParse({
        email: email.trim(),
        code: code.trim(),
        anon_id: this.deps.anonId,
        device: this.deps.device,
      })
      if (!request.success) throw new AccountError('invalid-code')
      const response = SignInResponseSchema.parse(
        await this.post(
          '/auth/magic-link/verify',
          request.data,
          undefined,
          generation,
          'email-verify',
        ),
      )
      if (generation !== this.generation) return
      await this.accept(response, generation)
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }
  private async accept(response: SignInResponse, generation: number): Promise<void> {
    const saved: SavedCredential = {
      accountId: response.user.id,
      deviceId: response.device_id,
      installationId: this.deps.device.installation_id,
      refreshToken: response.refresh_token,
    }
    const serialized = JSON.stringify(saved)
    if (generation !== this.generation) {
      await this.revoke(response)
      return
    }
    try {
      await this.save(async () => {
        await this.deps.vault.write(serialized)
        await this.deps.vault.clearLegacy?.()
      })
    } catch {
      await this.revoke(response)
      throw new AccountError('storage')
    }
    if (generation !== this.generation) {
      await this.clearSaved(serialized)
      await this.revoke(response)
      return
    }
    try {
      this.deps.bindAccount(response.user.id)
    } catch {
      await this.clearSaved(serialized)
      await this.revoke(response)
      throw new AccountError('account-mismatch')
    }
    if (generation !== this.generation) {
      await this.clearSaved(serialized)
      await this.revoke(response)
      return
    }
    this.credential = saved
    this.accessToken = response.access_token
    this.expiresAt = this.deps.now() + response.expires_in * 1000
    this.publish({
      status: 'signed-in',
      error: null,
      session: { accountId: saved.accountId, deviceId: saved.deviceId },
    })
  }
  private async clearSaved(serialized: string): Promise<void> {
    try {
      await this.save(async () => {
        if ((await this.deps.vault.read()) === serialized) await this.deps.vault.clear()
      })
    } catch {
      /* Cleanup is best effort; never admit a credential after cancellation. */
    }
  }
  private async revoke(response: SignInResponse): Promise<void> {
    try {
      await this.post(
        '/auth/logout',
        { refresh_token: response.refresh_token },
        { token: response.access_token, deviceId: response.device_id },
      )
    } catch {
      /* A failed local admission must never publish the account. */
    }
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
      await this.save(async () => {
        await this.deps.vault.clear()
        await this.deps.vault.clearLegacy?.()
      })
      if (generation !== this.generation) return null
      const response = TokenResponseSchema.parse(
        await this.post(
          '/auth/refresh',
          { refresh_token: saved.refreshToken },
          undefined,
          undefined,
          'refresh',
        ),
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
    const token = this.deps.now() < this.expiresAt ? this.accessToken : null
    const session = this.state.session
    const credential = this.credential
    const previousGeneration = this.generation
    const generation = ++this.generation
    this.abortAttempt(previousGeneration)
    this.accessToken = null
    this.credential = null
    this.publish({ status: 'signed-out', session: null, error: null })
    try {
      await this.save(async () => {
        await this.deps.vault.clear()
        await this.deps.vault.clearLegacy?.()
      })
    } catch {
      if (generation === this.generation) this.fail(new AccountError('storage'))
    }
    if ((token && session) || credential) {
      try {
        await this.post(
          '/auth/logout',
          credential ? { refresh_token: credential.refreshToken } : {},
          token && session ? { token, deviceId: session.deviceId } : undefined,
        )
      } catch {
        if (generation === this.generation && this.state.error !== 'storage')
          this.publish({ error: 'localSignOut' })
      }
    }
  }
}
