import { describe, expect, it } from 'vitest'
import { advanceChatTopic, ChatTopicResourceSchema, startChatTopic } from './chat-topic.js'

const topic = ChatTopicResourceSchema.parse({
  version: 1,
  topic_id: 'cafe',
  start_node: 'welcome',
  nodes: [
    {
      id: 'welcome',
      reply: { es: 'Hola.', en: 'Hello.' },
      suggestions: [
        { id: 'order', es: 'Un café.', en: 'A coffee.', register: 'neutral', next_node: 'served' },
      ],
      glosses: [],
    },
    {
      id: 'served',
      reply: { es: 'Aquí tienes.', en: 'Here you are.' },
      suggestions: [
        { id: 'thanks', es: 'Gracias.', en: 'Thanks.', register: 'neutral', next_node: 'welcome' },
      ],
      glosses: [],
    },
  ],
})

describe('bundled chat topic graphs (P3E-01)', () => {
  it('starts and advances only through authored edges', () => {
    expect(startChatTopic(topic).id).toBe('welcome')
    expect(advanceChatTopic(topic, 'welcome', 'order').id).toBe('served')
    expect(advanceChatTopic(topic, 'served', 'thanks').id).toBe('welcome')
  })

  it('rejects unresolved graph references during content validation', () => {
    expect(
      ChatTopicResourceSchema.safeParse({
        ...topic,
        nodes: [
          {
            ...topic.nodes[0],
            suggestions: [{ ...topic.nodes[0]!.suggestions[0]!, next_node: 'missing' }],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects a stale suggestion from another visible node', () => {
    expect(() => advanceChatTopic(topic, 'welcome', 'thanks')).toThrow(
      "Suggestion 'thanks' does not belong to 'welcome'",
    )
  })

  it('rejects duplicate suggestion IDs within one node', () => {
    const duplicate = ChatTopicResourceSchema.safeParse({
      ...topic,
      nodes: [
        {
          ...topic.nodes[0],
          suggestions: [
            ...topic.nodes[0]!.suggestions,
            { ...topic.nodes[0]!.suggestions[0]!, next_node: 'welcome' },
          ],
        },
        topic.nodes[1],
      ],
    })
    expect(duplicate.success).toBe(false)
  })
})
