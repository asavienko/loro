/**
 * Bundled open-chat topic graphs.
 *
 * This is deliberately separate from the guarded live-turn request. A bundled graph is the
 * offline floor for open chat: it contains only authored nodes and explicit next-node edges.
 * It neither creates turn IDs nor generates language, so callers must persist any learner turn
 * and assign its identity at their own boundary.
 */
import { z } from 'zod'
import { LineSchema, RegisterSchema, ResourceIdSchema as Key } from './common.js'
import { WordGlossSchema } from './catalog.js'

const ChatTopicSuggestionSchema = LineSchema.extend({
  id: Key,
  next_node: Key,
  register: RegisterSchema,
})

const ChatTopicNodeSchema = z.strictObject({
  id: Key,
  reply: LineSchema,
  suggestions: z.array(ChatTopicSuggestionSchema).min(1).max(5),
  glosses: z.array(WordGlossSchema).max(24),
})

export const ChatTopicResourceSchema = z
  .strictObject({
    version: z.int().nonnegative(),
    topic_id: Key,
    start_node: Key,
    nodes: z.array(ChatTopicNodeSchema).min(1).max(500),
  })
  .superRefine((topic, ctx) => {
    const ids = new Set(topic.nodes.map((node) => node.id))
    if (ids.size !== topic.nodes.length || !ids.has(topic.start_node)) {
      ctx.addIssue({ code: 'custom', message: 'Topic nodes must have unique IDs and a start node' })
    }
    if (topic.nodes.some((node) => node.suggestions.some((suggestion) => !ids.has(suggestion.next_node)))) {
      ctx.addIssue({ code: 'custom', message: 'All graph references must resolve to a node' })
    }
  })

export type ChatTopicResource = z.infer<typeof ChatTopicResourceSchema>
export type ChatTopicNode = ChatTopicResource['nodes'][number]
export type ChatTopicSuggestion = ChatTopicNode['suggestions'][number]

/** Resolve the authored node that starts a topic. Input must be schema-validated content. */
export function startChatTopic(topic: ChatTopicResource): ChatTopicNode {
  const start = topic.nodes.find((node) => node.id === topic.start_node)
  if (!start) throw new Error(`Topic '${topic.topic_id}' has no start node`)
  return start
}

/**
 * Follow an authored suggestion from the visible node. This intentionally rejects an ID from a
 * different node: a stale UI action must not jump a conversation graph after the thread advances.
 */
export function advanceChatTopic(
  topic: ChatTopicResource,
  nodeId: string,
  suggestionId: string,
): ChatTopicNode {
  const node = topic.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Unknown chat topic node '${nodeId}'`)

  const suggestion = node.suggestions.find((candidate) => candidate.id === suggestionId)
  if (!suggestion) throw new Error(`Suggestion '${suggestionId}' does not belong to '${nodeId}'`)

  const next = topic.nodes.find((candidate) => candidate.id === suggestion.next_node)
  if (!next) throw new Error(`Suggestion '${suggestionId}' has an unresolved target`)
  return next
}
