# v1.1 design contract and roadmap reconciliation

- **Requirement IDs:** introduces `NAV-01`…`NAV-16` and `P3E-01`…`P3E-18`; reconciles `F-03`,
  `F-05`, `F-06`, `AI-05`, and `AS-01`…`AS-04`
- **Milestone:** M1 documentation contract; v1.1 delivery mapping
- **Status:** ✅ Implemented 2026-07-30
- **Depends on:** none

## Outcome

The repository treats all four v1.1 design artifacts as one authored specification instead of
silently treating the nearly unchanged `Loro.dc.html` as the whole design. Stable requirements,
screen/state catalogs, architecture constraints, and roadmap ownership exist before the new menu,
developer workbench, or conversation loop is implemented.

## Design analysis

The v1.1 package adds functionality in separate artifacts:

| Artifact                | New contract                                                                                                                                                   | Implementation owner |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `Loro.dc.html`          | Existing 21-screen product blueprint; only two lines differ from the prior file                                                                                | Plans 54–78          |
| `Navigation.dc.html`    | Five surface classes, the spine, switcher, More menu, resume/exit/transport laws                                                                               | Plan 81              |
| `Loro Chat.dc.html`     | Open chat and message inspector, including text/voice input, corrections, suggestions, keeping, and review handoff                                             | Plans 82–83          |
| `Design System.dc.html` | Authored token/component map (stale 245/37 headline; verified package has 246 CSS variables/39 JSX components), navigation tokens, and three reference screens | Plans 57 and 80      |

The new chat is a product-level change. Current durable docs say Loro is “not a chatbot” and
ADR-0010 explicitly excludes open-ended chat. The design shows a free conversation but its
executable logic uses authored seed threads, deterministic regex corrections, browser speech
synthesis, and timed fixture replies. Those prototype mechanisms are not production requirements:
corrections and replies must be genuine, recorded audio must remain on-device, and the experience
must have a good offline floor.

## Work

1. Define source precedence and citations for the four v1.1 artifacts. Update `CLAUDE.md`, design
   indexes, README reading order, and blueprint references without editing the authored files.
2. Extend the screen catalog from 21 blueprint screens to 23 learner screens by adding Open chat and
   Message inspector. Catalog the navigation shell separately because it wraps screens rather than
   becoming a twenty-fourth learner destination. Catalog the dev workbench separately because it
   cannot ship as a learner route.
3. Add stable PRD requirements:
   - `NAV-01`…`NAV-16` for surface classes, route-owned menu metadata, spine, stateful rail, named
     back/cold entry, resumability, one escape at a time, honest empty sets, and travelling audio;
   - `P3E-01`…`P3E-18` for topic/pace, text and voice turns, translation reveal, suggestions,
     corrections, inspector content, save/remove, queue-for-review, restart, persistence, privacy,
     offline degradation, and provider safety.
4. Add functional specifications for every visible navigation and chat state. Cite exact ranges in
   `Navigation.dc.html` and `Loro Chat.dc.html`, not unrelated line numbers in `Loro.dc.html`.
5. Reconcile the vision, roadmap, practice-loop docs, AI services, privacy model, data model, API,
   offline contract, and ADR-0010. Record the chosen interpretation: chat may use a guarded live
   text provider, while bundled topic reply graphs and answer suggestions remain the usable offline
   floor. Learner audio never uploads; transcripts/thread text are excluded from telemetry and sync
   unless a later explicit consent decision changes that boundary.
6. Resolve naming collisions between the design's informal `N9`/`N13`…`N16` navigation laws and the
   PRD's existing `N-01`…`N-04` notification requirements. Durable docs use `NAV-*`; design
   citations retain the authored shorthand in parentheses.
7. Update the open-questions register with only decisions implementation cannot infer, including
   chat release entitlement/budget, local thread retention, provider text retention, and whether
   chat is an experiment or a committed v1.1 loop. Each question gets an owner and decision date.

## Acceptance criteria

- A contributor can discover all v1.1 sources from `README.md`, `CLAUDE.md`, and
  `docs/design/screen-catalog.md` without knowing the filenames in advance.
- Every new learner-visible state has a requirement ID, functional-spec home, release target, and
  owning plan; navigation chrome and the dev-only workbench are not miscounted as product screens.
- No durable document simultaneously says open chat is required and categorically forbidden.
- The production contract explicitly rejects prototype-only regex corrections, timer-driven fake
  replies, browser TTS as reference audio, fabricated recognition, and audio upload.
- `pnpm check` passes after documentation/content-link validation.

## Commit sequence

1. `docs(product): register v1.1 navigation and chat requirements (P3E-01)`
2. `docs(architecture): reconcile guarded chat and offline fallback (AI-05)`
3. `docs(design): index all v1.1 artifacts and states (NAV-01)`

## Out of scope

Runtime routes, UI components, provider code, persistence migrations, native audio/speech, and
changing the authored `.dc.html` files.

## Archive review — 2026-09-07

✅ Implemented scope retained as a historical record. Reviewed against merged baseline `2d9e8c3`;
historical test counts and temporary evidence paths above describe the original delivery. The
current disposition and remaining owners are in [REVIEW.md](REVIEW.md).
