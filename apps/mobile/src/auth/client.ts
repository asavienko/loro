/** F-01: provider authorization only. Session ownership lives in lib/account/client. */
import { OAuthStartResponseSchema, type OAuthProvider } from '@loro/core/api/oauth'

export interface AuthorizationPorts {
  random: () => string
  challenge: (verifier: string) => Promise<string>
  authorize: (url: string, redirect: string, windowName?: string) => Promise<string | null>
  redirect: string
}
export interface AuthPorts extends AuthorizationPorts {
  request: (path: string, body: unknown) => Promise<unknown>
  isCurrent: () => boolean
}
export async function authorizeProvider(
  provider: OAuthProvider,
  ports: AuthPorts,
  windowName?: string,
): Promise<{ ticket: string; code_verifier: string } | null> {
  const verifier = ports.random()
  const start = OAuthStartResponseSchema.parse(
    await ports.request(`/auth/${provider}/start`, {
      redirect_uri: ports.redirect,
      code_challenge: await ports.challenge(verifier),
    }),
  )
  if (!ports.isCurrent()) return null
  const callback = await ports.authorize(start.authorization_url, ports.redirect, windowName)
  if (!callback || !ports.isCurrent()) return null
  const url = new URL(callback)
  const redirect = new URL(ports.redirect)
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
  return { ticket, code_verifier: verifier }
}
