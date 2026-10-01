# 0015 · Write with DeepSeek on Fireworks and OpenRouter, draw covers with Muse Image

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** the owner (request and decisions of 2026-10-01, plan
  [111](../../../plans/111-open-model-providers.md))

## Context

The library's generators (phrase decks, notes, lyrics, covers, and the older `/v1/phrases/suggest`
route) asked Anthropic's Claude when `ANTHROPIC_API_KEY` was set, and fell back to labelled answers
(the phrase bank, Loro's written rules, the set's own phrases, a drawn pattern) without it. Covers
were shape specs the model wrote and the server rendered as SVG; PRD LIB-04 said covers are drawn,
never photos or invented text. The owner asked for open models instead: DeepSeek V4.1 Flash served
by Fireworks, the same model through OpenRouter when Fireworks fails, and Meta's Muse Image for
covers.

The forces: learner text (a topic, keywords, a pasted message or menu) reaches whoever serves the
model; the EC2 gateway answers within 28 s; an image model is slower than that; and the app labels
who wrote what, so a label naming one vendor would become false.

## Options considered

### A · Keep Anthropic as the primary, add the others as fallbacks

Least change, but the owner asked for Fireworks first, and two transports to keep tested for one
behaviour is more code than the fallback is worth.

### B · Route everything through OpenRouter alone

One key and one transport, but no control over which host serves the primary; Fireworks was asked
for by name.

### C · Fireworks, then OpenRouter, for text; OpenRouter for images (chosen)

Both text providers speak OpenAI chat completions with `response_format: json_schema`, so one
transport serves both. Images go through OpenRouter's `/api/v1/images`.

## Decision

- **Text:** `ChatCompletions` (`apps/api/src/integrations/openai-compatible/`) sends one request
  with a JSON-schema answer; `FallbackTextModel` tries Fireworks
  (`accounts/deepseek-ai/models/deepseek-v4p1-flash`), then OpenRouter
  (`deepseek/deepseek-v4.1-flash`), within one shared deadline. The caller's parser is the only
  gate; when both fail, the existing labelled fallback answers. Either key alone works.
- **Covers:** `OpenRouterImages` asks `meta/muse-image` for a square, wordless, flat illustration of
  the title. The bytes are accepted only as PNG, JPEG or WebP by their signature, capped at 2.5 MB,
  and carried inside the cover SVG as a `data:` image, still written only by `covers.ts`. If the
  picture fails, the text model designs a shape cover; failing that, the server draws its pattern.
- **Privacy:** OpenRouter requests carry `provider.data_collection: "deny"` (and, for text,
  `require_parameters: true`), so only providers that neither keep nor train on prompts, and that
  honour the schema, are routed. Fireworks keeps no prompt or generation data for open models unless
  the account opts in (zero data retention by default; Loro uses chat completions, not its Responses
  API, which stores by default). Recorded audio is never involved
  ([ADR-0011](0011-analytics-and-privacy.md)).
- **Covers are a job.** The cover request returns at once; the API draws in the background and the
  app polls `GET /library/covers/:id.json`. The set or album keeps its old cover until the new one
  is ready, so every cover URL stays immutable.
- **Labels:** the wire says `ai` where it said `claude`; stored rows are migrated and the app reads
  either.
- The Anthropic transport and `ANTHROPIC_API_KEY` are removed.

## Consequences

### Good

- One transport for both text providers, and a fallback that keeps the feature working through one
  provider's outage before the labelled fallbacks are needed.
- Covers are pictures of the subject rather than abstract shapes, without giving up the SVG
  pipeline, the cover URL or the gateway route.
- No label names a vendor; a later change of model changes no copy.

### Bad — accepted deliberately

- Learner text goes to more parties: Fireworks, and whichever no-retention provider OpenRouter
  picks.
- A cover can contain drawn text or something off-brand despite the prompt; the provider moderates,
  and the learner can draw again. LIB-04 changes from "never photos or invented text" to "drawn
  illustrations or shapes, asked to carry no text".
- A cover arrives seconds to minutes after it is asked for; older app builds, which waited for the
  cover in the request, see it only on their next refresh, and show no writer label against `ai`.
- Phrase decks still answer inside the request; on EC2 the chain has to fit the gateway's 28 s.

### Revisit if…

- A per-language-pair eval (Q-21) finds DeepSeek's Spanish or Bulgarian below the bar a learner
  needs.
- Fireworks' or OpenRouter's retention terms change, or Muse Image is routed to a provider that
  keeps prompts.
- Generated covers are reported for text or content often enough to outweigh the drawn patterns.
