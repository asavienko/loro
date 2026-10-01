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
import { FallbackTextModel, type StructuredTextModel } from './text-model.js'

/**
 * OpenRouter may route only to providers that neither keep nor train on prompts, and (for text)
 * only to those that honour every parameter sent, so the JSON schema is never silently dropped.
 */
export const OPENROUTER_PRIVACY = { data_collection: 'deny' } as const
const OPENROUTER_TEXT_ROUTING = { provider: { ...OPENROUTER_PRIVACY, require_parameters: true } }

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
          extraBody: OPENROUTER_TEXT_ROUTING,
          ...limits,
        },
        send,
      ),
    )
  }
  return models.length > 0 ? new FallbackTextModel(models, timeoutMs) : null
}
