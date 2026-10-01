# Open-model providers: DeepSeek writes, Muse Image illustrates

- **Requirement IDs:** `AI-05` (guarded generation with labelled fallbacks), `LIB-04` (covers)
- **Milestone:** Main app
- **Status:** 🟡 Started 2026-10-01 at the owner's request; scope 1–6 landed the same day, and the
  keys are in both encrypted environments. **Left:** scope 7's EC2 deploy (API, then the gateway
  stack), a tester APK, and a live Muse Image cover on a device. **Blocked by:** OpenRouter credit
  for images (`402 Insufficient credits`; text works and covers fall back to shapes meanwhile).
- **Owner request, 2026-10-01:** "I want to use openrouter as a fallback and text model
  deepseek/deepseek-v4.1-flash and for image generation meta/muse-image. And as a main provider use
  https://app.fireworks.ai/ deepseek/deepseek-v4.1-flash"
- **Owner decisions, 2026-10-01:** covers become AI illustrations with no text (LIB-04 changes);
  OpenRouter calls carry `provider.data_collection: "deny"`; the Anthropic integration is removed;
  the wire says `ai` where it said `claude`, and the app accepts both; after the first live run, a
  deck is a background job too, since no provider writes one inside the gateway's 30 s.
- **Depends on:** plan [106](106-connected-app.md) (the library's generators and their fallbacks).

## Outcome

Phrase sets, notes, lyrics and the older `/v1/phrases/suggest` route are written by DeepSeek V4.1
Flash on Fireworks, falling back to the same model through OpenRouter, then to the labelled
fallbacks that exist today. A cover is an illustration Muse Image draws through OpenRouter, in the
background while the app waits; if it can't, the text model designs a shape cover, and failing that
the server draws a pattern. Nothing a learner sees claims Claude wrote it.

## Decisions

- **One transport for both text providers.** Fireworks and OpenRouter both speak OpenAI chat
  completions with `response_format: json_schema`. `integrations/openai-compatible/` replaces
  `integrations/anthropic/` with the same guarantees: one attempt, a deadline, bounded request and
  response bytes, strict UTF-8, a process-wide concurrency cap, code-only failures, and the caller's
  parser as the only gate. A chain tries Fireworks, then OpenRouter with what is left of one shared
  deadline; the service's fallbacks answer when both fail.
- **Privacy.** Learner text reaches Fireworks (serverless, no prompt retention) or OpenRouter with
  `data_collection: "deny"`, so only providers that neither store nor train on prompts are routed.
  Text requests also send `require_parameters: true`, so a provider that ignores the JSON schema is
  never picked. Recorded audio is never involved.
- **Covers are a background job.** Muse Image reasons before it renders and the EC2 gateway stops at
  28 s. `POST /library/generate/cover` saves the cover as `rendering` and returns at once; the work
  runs in the API process like a song's, and `GET /library/covers/:id.json` reports `rendering`,
  `ready` or `failed`. The set or album keeps its old cover until the new one is ready, so a cover's
  SVG is written once and its `immutable` cache stays true.
- **The illustration travels inside the SVG.** The server checks the image bytes (PNG, JPEG or WebP
  by signature, size-capped) and embeds them as a `data:` URI in an SVG written by `covers.ts`, so
  the cover URL, the app's `SvgUri` renderer and the gateway's file route stay as they are. Still no
  script, link or markup from a model reaches the SVG; the cover CSP adds `img-src data:`.
- **Labels.** The wire's writer values become `ai` (phrases, notes, cover, lyrics). Stored rows
  (`library_covers.provider`, `library_songs.lyrics_by`) are migrated. The app maps `claude` to `ai`
  at its API boundary, so it works against an older server; older app builds show no writer label
  against this server until they update.

## Scope

1. This plan.
2. API: the OpenAI-compatible transport and the Fireworks → OpenRouter chain; the writers and the
   suggest route on it; `ai` labels and the migration; the Anthropic transport, its config and its
   README removed.
3. API: the OpenRouter image transport; covers as a job with the status route, the raster embedded
   in SVG, the CSP, migration `014`.
4. App: `ai` labels and copy (en, bg, ru); `generateCover` waits for the job; Make a set doesn't
   block on it.
5. Gateway: `covers/<id>.json` allowed; its tests.
6. Docs: ADR-0015 (providers and privacy), LIB-04, Q-21, `library.md`, `security-privacy.md`,
   `environments.md`, `ec2-deployment.md`, `.env.example`, `CLAUDE.md`.
7. Live: keys in `apps/api/.env` and `secrets/ec2-api.enc.env`; measured latency of each model; EC2
   deploy and gateway update; an APK for testers.

## Risks

- A synchronous phrase set must still answer inside the gateway's 28 s on EC2; the chain's budget is
  measured live before the EC2 key goes in, and lowered if Fireworks plus a fallback can't fit.
- Muse Image is served by Meta only and may be slow or refuse; a refusal costs nothing on OpenRouter
  and falls back to the shape cover.

## Measured, 2026-10-01

- Fireworks lists the model as `accounts/fireworks/models/deepseek-v4p1-flash`.
- A 12-phrase deck: Fireworks 111 s with DeepSeek's default reasoning (7,217 reasoning tokens),
  31–36 s with `reasoning_effort: none`; OpenRouter (`reasoning.effort: none`) 12 s or 65 s by the
  provider it routed to. Two parallel half-decks repeat each other, so they don't help.
- Notes for one phrase: 2–6 s. A Muse Image cover: 13 s, a 250 KB WebP at 1600×1600, flat and
  wordless as asked.
- End to end on a local API: a deck's request answered in 0.05 s (202) and the deck was ready 41 s
  later with clips; a cover's request answered at once and, with images refused for credit, the text
  model's shape cover was ready in 16 s.
