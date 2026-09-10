import {
  TtsRequestSchema,
  TtsResponseSchema,
  type TtsRequest,
  type TtsResponse,
} from '@loro/core/api/draft'
import { requestWithTimeout } from './backend'

export type TtsRenderErrorCode =
  'not-configured' | 'unavailable' | 'validation' | 'invalid-response' | 'quota'

export interface TtsCredentials {
  token: string
  deviceId: string
}

export class TtsRenderError extends Error {
  constructor(readonly code: TtsRenderErrorCode) {
    super(code)
    this.name = 'TtsRenderError'
  }
}

export async function requestListeningRender(
  request: TtsRequest,
  baseUrl: string | undefined,
  send: typeof fetch = fetch,
  credentials: TtsCredentials | null = null,
): Promise<TtsResponse> {
  if (!baseUrl) throw new TtsRenderError('not-configured')
  const body = TtsRequestSchema.parse(request)
  let response: Response
  try {
    response = await requestWithTimeout(
      `${baseUrl}/tts/render`,
      {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          ...(credentials === null
            ? {}
            : {
                Authorization: `Bearer ${credentials.token}`,
                'X-Loro-Device': credentials.deviceId,
              }),
        },
        body: JSON.stringify(body),
      },
      send,
    )
  } catch {
    throw new TtsRenderError('unavailable')
  }
  if (!response.ok) {
    if (response.status === 429) throw new TtsRenderError('quota')
    if (response.status === 422) throw new TtsRenderError('validation')
    throw new TtsRenderError('unavailable')
  }
  const parsed = TtsResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new TtsRenderError('invalid-response')
  return parsed.data
}
