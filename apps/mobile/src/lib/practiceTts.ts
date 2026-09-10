/**
 * Practice playback is catalog file, then API reference TTS. Never device TTS.
 * JSON stays metadata; native cache downloads bytes. Web plays the download URL.
 */
import {
  CATALOG_REFERENCE_VOICES,
  CATALOG_TTS_MODEL_ID,
  LISTENING_CODEC,
  REFERENCE_ASSET_CLASS,
  isTargetLocale,
  type TargetLocale,
} from '@loro/core'
import type { TtsRequest } from '@loro/core/api/draft'
import { bundledApiUrl } from './account/config'
import { audioCache, type AudioCacheController } from './audioCache'
import { resolveCatalogAudioUri, type CatalogAudio } from './catalogAudio'
import { requestWithTimeout } from './backend'
import { digestListeningText } from './listeningDigest'
import { requestListeningRender, TtsRenderError, type TtsCredentials } from './ttsRenderClient'

export type PracticeAudioSource = 'catalog' | 'api-tts' | 'unavailable'

export interface PracticePlayable {
  readonly uri: string
  readonly sha256?: string
  readonly source: Exclude<PracticeAudioSource, 'unavailable'>
}

export interface TtsRuntimeStatus {
  readonly ready: boolean
  readonly provider: string
}

export type PracticeRuntime = 'web' | 'native'

const rendered = new Map<string, { downloadUrl: string; sha256: string }>()

export function playableDownloadUrl(downloadUrl: string, apiBase: string): string {
  try {
    const download = new URL(downloadUrl)
    const api = new URL(apiBase)
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]'])
    if (loopback.has(download.hostname) && !loopback.has(api.hostname)) {
      download.protocol = api.protocol
      download.host = api.host
    }
    return download.toString()
  } catch {
    return downloadUrl
  }
}

export function referenceTtsRequest(
  text: string,
  locale: TargetLocale,
  phraseHash: string,
): TtsRequest {
  return {
    text,
    lang: locale,
    phrase_hash: phraseHash,
    voice_id: CATALOG_REFERENCE_VOICES[locale].id,
    model_id: CATALOG_TTS_MODEL_ID,
    asset_class: REFERENCE_ASSET_CLASS,
    codec: LISTENING_CODEC,
  }
}

export async function fetchTtsStatus(
  baseUrl: string | null = bundledApiUrl(),
  send: typeof fetch = fetch,
): Promise<TtsRuntimeStatus> {
  if (!baseUrl) return { ready: false, provider: 'unconfigured' }
  try {
    const response = await requestWithTimeout(
      `${baseUrl}/tts/status`,
      { credentials: 'omit', cache: 'no-store', redirect: 'error' },
      send,
      8_000,
    )
    if (!response.ok) return { ready: false, provider: 'unavailable' }
    const body: unknown = await response.json()
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return { ready: false, provider: 'unavailable' }
    }
    const ready = (body as { ready?: unknown }).ready
    const provider = (body as { provider?: unknown }).provider
    if (typeof ready !== 'boolean') return { ready: false, provider: 'unavailable' }
    return {
      ready,
      provider: typeof provider === 'string' && provider.length > 0 ? provider : 'unknown',
    }
  } catch {
    return { ready: false, provider: 'unavailable' }
  }
}

export async function resolvePracticePlayable(input: {
  text: string
  locale: string
  catalog?: CatalogAudio | null
  baseUrl?: string | null
  credentials?: TtsCredentials | null
  cache?: AudioCacheController
  runtime?: PracticeRuntime
  render?: typeof requestListeningRender
}): Promise<PracticePlayable | null> {
  const catalogUri = resolveCatalogAudioUri(input.catalog)
  if (catalogUri !== undefined) {
    return {
      uri: catalogUri,
      ...(input.catalog?.sha256 === undefined ? {} : { sha256: input.catalog.sha256 }),
      source: 'catalog',
    }
  }
  if (!isTargetLocale(input.locale)) return null
  const locale = input.locale
  const baseUrl = input.baseUrl === undefined ? bundledApiUrl() : input.baseUrl
  if (!baseUrl) return null
  const phraseHash = await digestListeningText(input.text)
  const cacheKey = `${locale}:${phraseHash}`
  const hit =
    rendered.get(cacheKey) ??
    (await renderReference({ ...input, locale }, phraseHash, baseUrl))
  if (hit === null) return null
  rendered.set(cacheKey, hit)
  const url = playableDownloadUrl(hit.downloadUrl, baseUrl)
  const runtime = input.runtime ?? (typeof document === 'undefined' ? 'native' : 'web')
  if (runtime === 'web') {
    return { uri: url, sha256: hit.sha256, source: 'api-tts' }
  }
  const cache = input.cache ?? audioCache
  if (!cache.available) return null
  const logicalKey = `practice:${hit.sha256}`
  const existing = await cache.lookup(logicalKey)
  const file =
    existing ??
    (await cache.download({
      url,
      expectedSha256: hit.sha256,
      logicalKey,
      pinClass: 'practice',
      ...(input.credentials === null || input.credentials === undefined
        ? {}
        : {
            authorization: input.credentials.token,
            deviceId: input.credentials.deviceId,
          }),
    }))
  return { uri: file.fileUri, sha256: hit.sha256, source: 'api-tts' }
}

export function clearPracticeTtsCache(): void {
  rendered.clear()
}

async function renderReference(
  input: {
    text: string
    locale: TargetLocale
    credentials?: TtsCredentials | null
    render?: typeof requestListeningRender
  },
  phraseHash: string,
  baseUrl: string,
): Promise<{ downloadUrl: string; sha256: string } | null> {
  const render = input.render ?? requestListeningRender
  try {
    const response = await render(
      referenceTtsRequest(input.text, input.locale, phraseHash),
      baseUrl,
      fetch,
      input.credentials ?? null,
    )
    if (response.asset_class !== REFERENCE_ASSET_CLASS) return null
    return { downloadUrl: response.download_url, sha256: response.sha256 }
  } catch (error) {
    if (error instanceof TtsRenderError && error.code === 'quota') throw error
    return null
  }
}
