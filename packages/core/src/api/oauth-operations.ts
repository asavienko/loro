import { z } from 'zod'
import type { Operation } from './operation.js'
import {
  OAuthExchangeSchema,
  OAuthProviderSchema,
  OAuthSessionSchema,
  OAuthStartSchema,
  OAuthStartResponseSchema,
  OAuthProvidersSchema,
  OAuthUserSchema,
} from './oauth.js'
export function oauthOperations(problem: z.ZodType): readonly Operation[] {
  const base = {
    status: 'implemented',
    auth: 'none',
    owner: 89,
    requirements: ['F-01', 'F-02', 'F-07'],
    behavior:
      'Configured Google/Apple OAuth verifies nonce and both app/provider PKCE where supported, then creates the same registered-device session used by email sign-in and account-scoped sync. All responses are no-store.',
  } as const
  const errors = Object.fromEntries(
    [401, 422, 429, 503, 500].map((status) => [
      status,
      { schema: problem, mediaType: 'application/problem+json' as const },
    ]),
  )
  const provider = { provider: OAuthProviderSchema }
  return [
    {
      ...base,
      id: 'oauthProviders',
      method: 'get',
      path: '/auth/providers',
      summary: 'Available sign-in providers',
      responses: { 200: { schema: OAuthProvidersSchema } },
    },
    {
      ...base,
      id: 'oauthStart',
      method: 'post',
      path: '/auth/{provider}/start',
      pathParams: provider,
      summary: 'Start provider sign-in',
      request: { schema: OAuthStartSchema },
      responses: { 200: { schema: OAuthStartResponseSchema }, ...errors },
    },
    ...(['get', 'post'] as const).map((method): Operation => ({
      ...base,
      id: method === 'get' ? 'oauthCallbackGet' : 'oauthCallbackPost',
      method,
      path: '/auth/{provider}/callback',
      pathParams: provider,
      summary: 'Provider callback',
      responses: {
        303: {
          schema: z.string(),
          headers: { Location: z.url() },
          description: 'Redirect with one-use PKCE-bound ticket and state, or generic error.',
        },
        ...errors,
      },
      behavior:
        'Google GET query or Apple application/x-www-form-urlencoded POST: state plus code or error. Consumes state once. Redirects only to the stored exact allowlisted URI. Never returns provider tokens.',
    })),
    {
      ...base,
      id: 'oauthExchange',
      method: 'post',
      path: '/auth/exchange',
      summary: 'Redeem app handoff',
      request: { schema: OAuthExchangeSchema },
      responses: { 200: { schema: OAuthSessionSchema }, ...errors },
    },
    {
      ...base,
      id: 'oauthMe',
      method: 'get',
      path: '/auth/me',
      summary: 'Read authenticated identity',
      auth: 'bearer',
      responses: { 200: { schema: OAuthUserSchema }, ...errors },
    },
  ]
}
