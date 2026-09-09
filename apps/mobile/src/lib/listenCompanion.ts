import {
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  LISTENING_INTER_GAP_MS,
  LISTENING_INTRA_GAP_MS,
  LISTENING_MODEL_ID,
  LISTENING_REPEATS_DEFAULT,
  approvedListeningVoices,
  canGenerateListening,
  canListenFromCache,
  canShareListening,
  clampListeningRepeats,
  listeningBlockers,
  listeningClipKey,
  listeningModelIsPinned,
  listeningVoiceSequence,
  planListeningBatch,
  type ListeningAvailabilityInput,
  type ListeningBlocker,
  type ListeningPhraseLine,
  type ListeningRepeats,
  type TargetLocale,
} from '@loro/core'
import type { TtsRequest } from '@loro/core/api/draft'
import { AudioCacheError, type AudioCacheController, type AudioCacheObject } from './audioCacheController'
import { apiUrl } from './backend'
import { requestListeningRender, TtsRenderError } from './ttsRenderClient'
import { digestListeningText } from './listeningDigest'
import { isNetworkAvailable } from './connectivity'

export type ListenPhase =
  | 'idle'
  | 'generating'
  | 'partial'
  | 'cancelled'
  | 'ready'
  | 'playing'
  | 'error'

export interface ListenProgress {
  done: number
  total: number
  failed: number
}

export interface ListenViewModel {
  phase: ListenPhase
  blockers: readonly ListeningBlocker[]
  phraseCount: number
  repeats: ListeningRepeats
  voices: readonly { id: string; name: string; licensed: boolean }[]
  sequence: readonly string[]
  progress: ListenProgress
  durationMs: number | null
  generateEnabled: boolean
  listenEnabled: boolean
  shareEnabled: boolean
  nativeCache: boolean
}

export function availabilityFromDevice(input: {
  phraseCount: number
  locale: TargetLocale
  network: boolean
  configured: boolean
  nativeCache: boolean
  sessionBusy: boolean
  diskFull: boolean
  quotaExceeded: boolean
}): ListeningAvailabilityInput {
  return {
    phraseCount: input.phraseCount,
    voiceCount: approvedListeningVoices(input.locale).length,
    modelPinned: listeningModelIsPinned(),
    network: input.network,
    configured: input.configured,
    nativeCache: input.nativeCache,
    sessionBusy: input.sessionBusy,
    diskFull: input.diskFull,
    quotaExceeded: input.quotaExceeded,
  }
}

export function listenViewModel(input: {
  phase: ListenPhase
  locale: TargetLocale
  phrases: readonly ListeningPhraseLine[]
  repeats: number
  network: boolean
  configured: boolean
  nativeCache: boolean
  sessionBusy: boolean
  diskFull: boolean
  quotaExceeded: boolean
  cacheComplete: boolean
  progress: ListenProgress
  durationMs: number | null
}): ListenViewModel {
  const repeats = clampListeningRepeats(input.repeats)
  const voices = approvedListeningVoices(input.locale)
  const availability = availabilityFromDevice({
    phraseCount: input.phrases.length,
    locale: input.locale,
    network: input.network,
    configured: input.configured,
    nativeCache: input.nativeCache,
    sessionBusy: input.sessionBusy,
    diskFull: input.diskFull,
    quotaExceeded: input.quotaExceeded,
  })
  const blockers = listeningBlockers(availability)
  return {
    phase: input.phase,
    blockers,
    phraseCount: input.phrases.length,
    repeats,
    voices,
    sequence: listeningVoiceSequence(voices, repeats),
    progress: input.progress,
    durationMs: input.durationMs,
    generateEnabled: canGenerateListening(availability) && input.phase !== 'generating',
    listenEnabled: canListenFromCache({
      cacheComplete: input.cacheComplete,
      nativeCache: input.nativeCache,
      sessionBusy: input.sessionBusy,
    }),
    shareEnabled: canShareListening() && input.cacheComplete && input.nativeCache,
    nativeCache: input.nativeCache,
  }
}

export interface PrepareListeningDeps {
  cache: AudioCacheController
  locale: TargetLocale
  phrases: readonly ListeningPhraseLine[]
  repeats: number
  baseUrl?: string | undefined
  digest?: (text: string) => Promise<string>
  render?: typeof requestListeningRender
  network?: () => Promise<boolean>
  onProgress?: (progress: ListenProgress) => void
  signal?: AbortSignal
}

export async function prepareListeningBatch(deps: PrepareListeningDeps): Promise<{
  phase: 'ready' | 'partial' | 'cancelled'
  progress: ListenProgress
  clips: readonly AudioCacheObject[]
}> {
  const voices = approvedListeningVoices(deps.locale)
  const takes = planListeningBatch(deps.phrases, voices, deps.repeats)
  const digest = deps.digest ?? digestListeningText
  const render = deps.render ?? requestListeningRender
  const clips: AudioCacheObject[] = []
  let failed = 0
  const keys: string[] = []
  if (deps.signal?.aborted) {
    return {
      phase: 'cancelled',
      progress: { done: 0, total: takes.length, failed: 0 },
      clips,
    }
  }
  if (takes.length === 0) {
    return {
      phase: 'partial',
      progress: { done: 0, total: 0, failed: 0 },
      clips,
    }
  }
  for (const take of takes) {
    if (deps.signal?.aborted) {
      return {
        phase: 'cancelled',
        progress: { done: clips.length, total: takes.length, failed },
        clips,
      }
    }
    const textDigest = await digest(take.targetText)
    const modelId = LISTENING_MODEL_ID
    if (modelId === null) {
      failed += 1
      deps.onProgress?.({ done: clips.length, total: takes.length, failed })
      continue
    }
    const logicalKey = listeningClipKey({
      assetClass: LISTENING_ASSET_CLASS,
      locale: deps.locale,
      phraseId: take.phraseId,
      textDigest,
      voiceId: take.voiceId,
      modelId,
      codec: LISTENING_CODEC,
    })
    keys.push(logicalKey)
    const hit = await deps.cache.lookup(logicalKey)
    if (hit !== null) {
      clips.push(hit)
      deps.onProgress?.({ done: clips.length, total: takes.length, failed })
      continue
    }
    if (!(await (deps.network ?? isNetworkAvailable)())) {
      failed += 1
      deps.onProgress?.({ done: clips.length, total: takes.length, failed })
      continue
    }
    const request: TtsRequest = {
      text: take.targetText,
      lang: deps.locale,
      phrase_hash: textDigest,
      voice_id: take.voiceId,
      model_id: modelId,
      asset_class: LISTENING_ASSET_CLASS,
      codec: LISTENING_CODEC,
      phrase_id: take.phraseId,
    }
    try {
      const meta = await render(request, deps.baseUrl ?? apiUrl)
      const stored = await deps.cache.download({
        url: meta.download_url,
        expectedSha256: meta.sha256,
        logicalKey,
        pinClass: 'listening',
      })
      clips.push(stored)
    } catch (error) {
      if (error instanceof AudioCacheError && error.code === 'cancelled') {
        return {
          phase: 'cancelled',
          progress: { done: clips.length, total: takes.length, failed },
          clips,
        }
      }
      if (error instanceof AudioCacheError && error.code === 'disk-full') throw error
      if (error instanceof TtsRenderError || error instanceof AudioCacheError) failed += 1
      else failed += 1
    }
    deps.onProgress?.({ done: clips.length, total: takes.length, failed })
  }
  if (keys.length > 0) await deps.cache.pin(keys)
  const progress = { done: clips.length, total: takes.length, failed }
  return {
    phase: failed === 0 && clips.length === takes.length ? 'ready' : 'partial',
    progress,
    clips,
  }
}

export async function shareListeningBatch(
  cache: AudioCacheController,
  request: Parameters<AudioCacheController['concatenate']>[0],
): Promise<AudioCacheObject> {
  if (!canShareListening()) throw new AudioCacheError('share-gated')
  const file = await cache.concatenate(request)
  await cache.share(file.fileUri)
  return file
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new AudioCacheError('cancelled'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export const LISTEN_PLAYBACK_PREFIX = 'listen:'

export function isListenPlaybackId(phraseId: string | null): boolean {
  return phraseId?.startsWith(LISTEN_PLAYBACK_PREFIX) === true
}

export async function playListeningSequence(input: {
  clips: readonly AudioCacheObject[]
  repeats: number
  playFile: (phraseId: string, fileUri: string, onEnded?: () => void) => Promise<void>
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
}): Promise<void> {
  const takes = clampListeningRepeats(input.repeats)
  const wait = input.wait ?? delay
  for (const [index, clip] of input.clips.entries()) {
    if (input.signal?.aborted) throw new AudioCacheError('cancelled')
    if (!clip.fileUri.startsWith('file:')) throw new AudioCacheError('invalid-url')
    await new Promise<void>((resolve, reject) => {
      void input
        .playFile(`${LISTEN_PLAYBACK_PREFIX}${index}`, clip.fileUri, resolve)
        .catch(reject)
    })
    const last = index === input.clips.length - 1
    if (!last) {
      const gap = (index + 1) % takes === 0 ? LISTENING_INTER_GAP_MS : LISTENING_INTRA_GAP_MS
      await wait(gap, input.signal)
    }
  }
}

export { LISTENING_REPEATS_DEFAULT }

/** Force-quit must still see a complete pinned batch. Missing files are a miss, not a hit. */
export async function restoreListeningBatch(
  cache: AudioCacheController,
): Promise<readonly AudioCacheObject[] | null> {
  return cache.loadListeningBatch()
}
