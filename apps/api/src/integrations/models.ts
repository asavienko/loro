/**
 * The configured model providers (plan 111): the one place keys in the environment become
 * transports. Fireworks answers first; OpenRouter serves the same model when Fireworks fails, and
 * draws covers.
 */
import { config } from '../common/config.js'
import {
  ChatCompletions,
  FIREWORKS_CHAT_URL,
  OPENROUTER_CHAT_URL,
} from './openai-compatible/chat.js'
import { OpenRouterImages, type ImageModel } from './openrouter/images.js'
import { FallbackTextModel, type StructuredTextModel } from './text-model.js'

/**
 * OpenRouter may route only to providers that neither keep nor train on prompts, and (for text)
 * only to those that honour every parameter sent, so the JSON schema is never silently dropped.
 */
export const OPENROUTER_PRIVACY = { data_collection: 'deny' } as const
/**
 * DeepSeek reasons before it answers unless told not to: measured 2026-10-01, a 12-phrase deck on
 * Fireworks took 111 s with 7,217 reasoning tokens, and 32–34 s without, at the same quality.
 */
const FIREWORKS_TEXT_OPTIONS = { reasoning_effort: 'none' }
const OPENROUTER_TEXT_OPTIONS = {
  provider: { ...OPENROUTER_PRIVACY, require_parameters: true },
  reasoning: { effort: 'none' },
}

export interface TextBudget {
  /** The whole chain's deadline: the fallback gets what the primary leaves. */
  timeoutMs: number
  /** The primary's own cap, so a slow primary still leaves the fallback time. */
  primaryTimeoutMs: number
  maxTokens: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentRequests: number
}

export function textModelConfigured(): boolean {
  return Boolean(config.fireworksApiKey() ?? config.openRouterApiKey())
}

/** The configured text chain, or null: the owning service's labelled fallback answers instead. */
export function textModel(
  budget: TextBudget,
  send: typeof fetch = fetch,
): StructuredTextModel | null {
  const { timeoutMs, primaryTimeoutMs, ...limits } = budget
  const fireworks = config.fireworksApiKey()
  const openRouter = config.openRouterApiKey()
  const models: StructuredTextModel[] = []
  if (fireworks) {
    models.push(
      new ChatCompletions(
        {
          name: 'fireworks',
          url: FIREWORKS_CHAT_URL,
          apiKey: fireworks,
          model: config.fireworksModel(),
          timeoutMs: openRouter ? Math.min(primaryTimeoutMs, timeoutMs) : timeoutMs,
          extraBody: FIREWORKS_TEXT_OPTIONS,
          ...limits,
        },
        send,
      ),
    )
  }
  if (openRouter) {
    models.push(
      new ChatCompletions(
        {
          name: 'openrouter',
          url: OPENROUTER_CHAT_URL,
          apiKey: openRouter,
          model: config.openRouterTextModel(),
          timeoutMs,
          extraBody: OPENROUTER_TEXT_OPTIONS,
          ...limits,
        },
        send,
      ),
    )
  }
  return models.length > 0 ? new FallbackTextModel(models, timeoutMs) : null
}

export function imageModelConfigured(): boolean {
  return Boolean(config.openRouterApiKey())
}

/** The image model through OpenRouter's key, or null: covers are designed or drawn instead. */
export function imageModel(
  limits: { timeoutMs: number; maxImageBytes: number; maxConcurrentRequests: number },
  send: typeof fetch = fetch,
): ImageModel | null {
  const apiKey = config.openRouterApiKey()
  if (!apiKey) return null
  return new OpenRouterImages(
    {
      apiKey,
      model: config.openRouterImageModel(),
      maxPromptBytes: 2_000,
      extraBody: { provider: OPENROUTER_PRIVACY },
      ...limits,
    },
    send,
  )
}
