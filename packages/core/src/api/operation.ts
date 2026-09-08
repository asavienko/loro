/** Transport metadata is data, with no Nest, fs or generator dependency. */
import type { z } from 'zod'

export interface Example {
  name: string
  value: unknown
}
export interface Payload {
  schema: z.ZodType
  examples?: readonly Example[]
  description?: string
}
export interface ResponseContract extends Payload {
  mediaType?: 'application/json' | 'application/problem+json' | 'text/event-stream'
  headers?: Readonly<Record<string, z.ZodType>>
  /** An alternate representation for the same status (e.g. negotiated SSE). */
  alternate?: Payload & { mediaType: 'text/event-stream' }
}
export interface Operation {
  id: string
  method: 'get' | 'post' | 'delete'
  path: string
  summary: string
  status: 'implemented' | 'planned' | 'draft'
  requirements: readonly string[]
  owner: number
  gates?: readonly string[]
  unresolved?: readonly string[]
  auth: 'none' | 'bearer' | 'staff' | 'provider-signature'
  query?: Readonly<Record<string, z.ZodType>>
  pathParams?: Readonly<Record<string, z.ZodType>>
  headers?: Readonly<Record<string, z.ZodType>>
  request?: Payload & { required?: boolean }
  responses: Readonly<Record<number, ResponseContract>>
  behavior: string
  maxBodyBytes?: number
}
