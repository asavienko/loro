# Anthropic transport — plan 86 / AI-05

`AnthropicMessages` is a provider-local HTTP adapter. It is **not registered** in Nest and cannot be
enabled by setting `AI_PROVIDER`. No application API contracts are defined here.

The adapter sends one text-only Messages API request to the fixed HTTPS provider endpoint. It uses
explicit model, token, byte and deadline limits supplied by the eventual composition root; there are
no environment readers or model defaults. It disables redirects and automatic retries, bounds
streamed response bytes, rejects incomplete/refused/tool output, parses structured JSON, and
requires a caller-provided parser before returning a result. Exceptions contain only a fixed failure
code: no provider response, input, API key, or underlying cause is retained.

The response parser must enforce the eventual runtime schema and semantic/safety requirements.
Provider JSON-schema guidance alone is not validation. Schema and system prompt are trusted
server-authored configuration; learner text belongs only in bounded message content. Only text
message fields are serialized, never arbitrary attachments or tools.

## Runtime handoff still required

Before registration, consume the merged plan-85 target contracts and implement identity/entitlement
guards, rate/concurrency controls, atomic budget reservations and reconciliation, approved
retention, request-context policy, semantic/safety evaluation, and bundled fallback. These controls
are not implemented by this low-level transport. The service must account for possible provider
charges on timeouts; a timed-out request is not evidence of zero spend. Retry only under the owning
idempotency and spend policy, never automatically inside the adapter.

Credentials and production text are not needed for tests. A injected fetch exercises deterministic
failure modes; a loopback server on an ephemeral port proves a stalled HTTP body is aborted. No live
Anthropic traffic is sent. The tests establish transport behavior, not Spanish quality or production
readiness.

Reference:
[Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
