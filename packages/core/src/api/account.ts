import { z } from 'zod'
import { ResourceIdSchema, RowIdSchema, TimestampSchema, CountSchema } from './common.js'
export const DeviceRegistrationSchema = z.strictObject({
  installation_id: RowIdSchema,
  platform: z.enum(['ios', 'android', 'web']),
  app_version: z.string().max(100),
})
export const SignInRequestSchema = z.strictObject({
  identity_token: z.string().min(1).max(16384),
  anon_id: RowIdSchema,
  device: DeviceRegistrationSchema,
})
/** Older imported accounts have no recorded creation instant; never fabricate one. */
export const UserSchema = z.looseObject({
  id: ResourceIdSchema,
  created_at: TimestampSchema.nullable(),
})
export const ClaimResultSchema = z.looseObject({
  performed: z.boolean(),
  mode: z.enum(['bind', 'merge']).nullable(),
  claim_id: ResourceIdSchema,
  upload_required: z.boolean(),
})
export const TokenResponseSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.literal(900),
  refresh_token: z.string().min(1),
})
export const SignInResponseSchema = TokenResponseSchema.extend({
  user: UserSchema,
  device_id: ResourceIdSchema,
  claim: ClaimResultSchema,
})
export const MagicLinkRequestSchema = z.strictObject({ email: z.email().max(254) })
export const MagicVerifyRequestSchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
  anon_id: RowIdSchema,
  device: DeviceRegistrationSchema,
})
export const MagicLinkResponseSchema = z.looseObject({ status: z.literal('accepted') })
export const RefreshRequestSchema = z
  .strictObject({
    refresh_token: z.string().min(1).max(16384),
    device: DeviceRegistrationSchema.optional(),
    anon_id: RowIdSchema.optional(),
  })
  .refine((request) => (request.device === undefined) === (request.anon_id === undefined), {
    message: 'Device registration and anonymous correlation must be supplied together',
  })
/** Bearer + registered device required. anon_id is a local correlation ID, not a credential. */
export const ClaimRequestSchema = z.strictObject({
  anon_id: RowIdSchema,
  device_id: ResourceIdSchema,
  request_id: RowIdSchema,
})
export const ExportQueuedSchema = z.looseObject({
  job_id: ResourceIdSchema,
  status: z.literal('queued'),
})
export const ExportStatusSchema = z.discriminatedUnion('status', [
  z.looseObject({ job_id: ResourceIdSchema, status: z.enum(['queued', 'running']) }),
  z.looseObject({
    job_id: ResourceIdSchema,
    status: z.literal('ready'),
    url: z.url(),
    expires_in: CountSchema,
    schema_version: z.literal(1),
  }),
  z.looseObject({
    job_id: ResourceIdSchema,
    status: z.literal('failed'),
    code: z.literal('INTERNAL'),
  }),
  z.looseObject({ job_id: ResourceIdSchema, status: z.literal('expired') }),
])
export const DeleteAccountRequestSchema = z.strictObject({ confirm: z.literal('DELETE') })
export const DeleteAccountResponseSchema = z.looseObject({ scheduled_for: TimestampSchema })
export type SignInRequest = z.infer<typeof SignInRequestSchema>
export type SignInResponse = z.infer<typeof SignInResponseSchema>
export type ClaimRequest = z.infer<typeof ClaimRequestSchema>
export type ClaimResult = z.infer<typeof ClaimResultSchema>
export type ExportStatus = z.infer<typeof ExportStatusSchema>
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>

export type DeviceRegistration = z.infer<typeof DeviceRegistrationSchema>

export type User = z.infer<typeof UserSchema>

export type TokenResponse = z.infer<typeof TokenResponseSchema>

export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>

export type MagicVerifyRequest = z.infer<typeof MagicVerifyRequestSchema>

export type MagicLinkResponse = z.infer<typeof MagicLinkResponseSchema>

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>

export type ExportQueued = z.infer<typeof ExportQueuedSchema>
