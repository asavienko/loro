# Generative Discover and phrase reach

- **Requirement IDs:** `P2-03`, `P2-04`, `P2-06`, `P2-07`, `AI-02`, `AI-05`, `AI-06`, `F-03`, `F-04`
- **Milestone:** M3 garnish; authoring-time drafts may proceed now
- **Status:** 🟡 Shared candidate/handoff, Discover Add-your-own floor, bundled topic suggestions
  and a stub `/v1/phrases/suggest` exist. Live provider traffic remains behind **Q-21**. Chat
  screens stay 82/83; they consume the handoff contract only.
- **Depends on:** 59 persistence; 61/87 for authored catalog publication and bilingual review; 65
  Import/OCR remains separate; 76/86 transport/spend for a future live path; 82/83 consume the
  keep-line handoff
- **Number allocation:** 97 follows inspection of active, archived and concurrent plan files. 95 and
  archived 96 (account sign-in) are archived. Active phrase-music reuses 96 (unresolved collision).
  Plan 98 owns voice/TTS. Plan 99 owns the online-first listening companion. Archived plan 100 owns
  hygiene/reuse/tooling; active `100-ui-design-system.md` is the motion kit under the same number
  (unresolved collision). The next new plan is 101.

## Outcome

A learner can **reach useful phrases for a real situation** when the starter catalog does not cover
it, without breaking offline practice, the no-shame rule, or “nothing enters the stream without an
explicit tap.”

Three layers share one add path:

1. **Authored floor** — Discover search, Popular starters and scenario chips stay first.
   Authoring-time generation may draft extra catalog/scenario lines for **human review**; it never
   publishes itself.
2. **Discover garnish** — a clearly marked **Suggested for this** section may appear for a topic
   query with few library hits. Candidates are own-phrase drafts, not catalog rows.
3. **Chat keep-line** — plan 82/83 render chat; this plan owns the shared candidate and add-handoff
   so a saved chat line writes through the same tagging sheet / `addOwnPhrase` path.

## Product and privacy boundary

[ADR-0010](../docs/architecture/adr/0010-llm-roleplay-and-guardrails.md) still forbids generating
**catalog** phrases at runtime. This plan amends it to allow **runtime own-phrase candidates** with:

- no catalog id
- visible provenance
- editable target and meaning before add
- never auto-add
- eval-gated live traffic (Q-21)

Recorded audio is structurally absent from the suggest request and endpoint. Learner query text is
untrusted data. Telemetry may carry IDs, booleans, counts, timings and safety codes — never phrase
text.

Offline Discover remains complete: catalog, scenarios, nearest-scenario hint and Add your own.

## Remaining work

1. [x] Land this plan, ADR-0010 amendment, Q-21, AI-06 and index updates.
2. [x] Shared `PhraseCandidate` / add-handoff, `generated`/`chat` sources, canonical dedup and
       tests. Import and chat keep-line can call the factory without UI.
3. [x] Discover P2-07 Add your own row and nearest-scenario hint, with E2E states.
4. [x] Authoring-time draft schema, stub drafter and validators; drafts cannot enter the bundled
       catalog.
5. [x] Guarded `/v1/phrases/suggest` stub, schema/safety, silent empty fallback and stub/safety
       eval. Live Anthropic dispatch stays off until Q-21.
6. [x] Discover Suggested-for-this section, editable tagging, provenance, stale-request cancel.
7. [ ] Q-21 live enablement: eval thresholds, spend caps shared with other AI paths, provider
       retention, and pair-by-pair quality sign-off.

## Acceptance criteria

- Unmatched Discover query offers Add your own; the empty-library dead end is gone.
- Catalog and scenario paths are unchanged when they have hits.
- Suggested rows never look like library phrases, never auto-add, and persist as own-phrases with
  undo.
- Airplane mode: search, scenarios and Add your own work; no fake suggestions.
- Invalid or late provider/stub results cannot overwrite a newer query.
- No JS/API type for this feature accepts audio.
- Chat keep-line can call the same handoff in tests even if chat UI is unbuilt.
- Authored drafts cannot reach learners without the content review gate.

## Commit sequence

1. `docs(docs): add 97 generative phrase reach (AI-06)`
2. `feat(core): shared phrase candidate and add-handoff (AI-06)`
3. `feat(mobile): Discover add-your-own and topic floor (P2-07)`
4. `feat(content): authoring-time scenario/phrase drafts (AI-02)`
5. `feat(api): guarded phrase suggest (AI-05, AI-06)`
6. `feat(mobile): Discover suggested section (AI-06)`

## Out of scope

Chat conversation UI, Roleplay scenes, OCR, bulk Add-all for generated sets, writing generated lines
into the shared catalog, scoring or ranking practice with an LLM, a new home-rail destination
(Q-17).
