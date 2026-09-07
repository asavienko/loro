/** F-01. Session lifecycle has no dependency on the learning store. */
import {
  OAuthSessionSchema,
  OAuthStartResponseSchema,
  type OAuthProvider,
  type OAuthSession,
} from '@loro/core/api/oauth'
export interface AuthPorts {
  request: (path: string, body?: unknown) => Promise<unknown>
  read: () => Promise<string | null>
  write: (token: string | null) => Promise<void>
  random: () => string
  challenge: (verifier: string) => Promise<string>
  authorize: (url: string, redirect: string) => Promise<string | null>
  redirect: string
}
export class AccountClient {
  session: OAuthSession | null = null
  private refreshing: Promise<void> | undefined
  private restoring: Promise<void> | undefined
  private signingIn = false
  constructor(private readonly ports: AuthPorts) {}
  async restore(): Promise<void> {
    if (this.signingIn) throw new Error('Account request in progress')
    this.restoring ??= (async () => {
      const token = await this.ports.read()
      if (token) await this.rotate(token)
    })().finally(() => {
      this.restoring = undefined
    })
    await this.restoring
  }
  async signIn(provider: OAuthProvider): Promise<'signedIn' | 'cancelled'> {
    if (this.signingIn || this.restoring || this.refreshing)
      throw new Error('Account request in progress')
    this.signingIn = true
    try {
      return await this.authorize(provider)
    } finally {
      this.signingIn = false
    }
  }
  private async authorize(provider: OAuthProvider): Promise<'signedIn' | 'cancelled'> {
    const verifier = this.ports.random()
    const start = OAuthStartResponseSchema.parse(
      await this.ports.request(`/auth/${provider}/start`, {
        redirect_uri: this.ports.redirect,
        code_challenge: await this.ports.challenge(verifier),
      }),
    )
    const callback = await this.ports.authorize(start.authorization_url, this.ports.redirect)
    if (!callback) return 'cancelled'
    const url = new URL(callback),
      redirect = new URL(this.ports.redirect)
    if (
      url.origin !== redirect.origin ||
      url.pathname !== redirect.pathname ||
      url.protocol !== redirect.protocol ||
      url.host !== redirect.host ||
      url.searchParams.get('state') !== start.state ||
      url.searchParams.has('error')
    )
      throw new Error('Sign-in failed')
    const ticket = url.searchParams.get('ticket')
    if (!ticket) throw new Error('Missing sign-in ticket')
    await this.accept(
      await this.ports.request('/auth/exchange', { ticket, code_verifier: verifier }),
    )
    return 'signedIn'
  }
  async refresh(): Promise<void> {
    if (this.restoring) return this.restoring
    if (this.signingIn) throw new Error('Account request in progress')
    if (!this.refreshing) {
      const token = this.session?.refresh_token
      this.refreshing = (token ? this.rotate(token) : Promise.resolve()).finally(() => {
        this.refreshing = undefined
      })
    }
    await this.refreshing
  }
  private async rotate(token: string): Promise<void> {
    // Consume local refresh before sending. An uncertain response is never retried with it.
    this.session = null
    await this.ports.write(null)
    await this.accept(await this.ports.request('/auth/refresh', { refresh_token: token }))
  }
  private async accept(value: unknown): Promise<void> {
    const session = OAuthSessionSchema.parse(value)
    try {
      await this.ports.write(session.refresh_token)
    } catch (error) {
      await this.ports
        .request('/auth/logout', { refresh_token: session.refresh_token })
        .catch(() => undefined)
      throw error
    }
    this.session = session
  }
  async signOut(): Promise<boolean> {
    if (this.signingIn || this.restoring || this.refreshing)
      throw new Error('Account request in progress')
    const token = this.session?.refresh_token
    await this.ports.write(null)
    this.session = null
    if (!token) return true
    try {
      await this.ports.request('/auth/logout', { refresh_token: token })
      return true
    } catch {
      return false
    }
  }
}
