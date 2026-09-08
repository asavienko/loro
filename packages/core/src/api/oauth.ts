/** F-01/F-02: OAuth handoff into the shared device-bound account and sync session. */
import { z } from 'zod'
import {
  DeviceRegistrationSchema,
  SignInResponseSchema,
  RefreshRequestSchema,
  UserSchema,
} from './account.js'
import { RowIdSchema } from './common.js'
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
  device: DeviceRegistrationSchema,
  anon_id: RowIdSchema,
})
export const OAuthRefreshSchema = RefreshRequestSchema
export const OAuthSessionSchema = SignInResponseSchema
export type OAuthSession = z.infer<typeof OAuthSessionSchema>

export const OAuthProvidersSchema = z.object({ providers: z.array(OAuthProviderSchema) })
export const OAuthUserSchema = UserSchema
