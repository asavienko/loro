/** F-01/F-02: implemented identity-only flow; no anonymous claim or sync promise. */
import { z } from 'zod'
export const OAuthProviderSchema = z.enum(['google', 'apple'])
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>
const SecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export const OAuthStartSchema = z.strictObject({
  redirect_uri: z.url().max(2048),
  code_challenge: SecretSchema,
})
export const OAuthStartResponseSchema = z.object({
  authorization_url: z.url(),
  state: SecretSchema,
})
export const OAuthExchangeSchema = z.strictObject({
  ticket: SecretSchema,
  code_verifier: SecretSchema,
})
export const OAuthRefreshSchema = z.strictObject({ refresh_token: SecretSchema })
export const OAuthSessionSchema = z.object({
  access_token: z.string().min(1).max(4096),
  refresh_token: SecretSchema,
  expires_in: z.literal(900),
  user: z.object({ id: z.uuid(), provider: OAuthProviderSchema }),
})
export type OAuthSession = z.infer<typeof OAuthSessionSchema>

export const OAuthProvidersSchema = z.object({ providers: z.array(OAuthProviderSchema) })
export const OAuthUserSchema = OAuthSessionSchema.shape.user
