# Backend integration inventory

**Status:** Contract work, plan 85 (F-04). The mobile app has no HTTP client; seven learner routes
exist and use local in-memory state. Ten development API routes exist; none authenticates callers.
An endpoint in the target specification does not mean the server implements it.

Source precedence: the [screen catalog](../design/screen-catalog.md) maps authored artifacts;
[PRD](../product/prd.md) supplies requirement IDs. Every screen writes locally first. Sync is
background convergence, never a practice dependency. **There is no per-screen CRUD API.**

Paths below are relative to `/v1`. Schema names refer to `@loro/core/api/target` unless marked
`draft`; current contracts are independently exported by `@loro/core/api/current`.

## All 23 authored screens

| # / screen          | Requirements / source                          | Current state                         | Integration / contract                                                          | Offline behavior                                                         | Owner plan     |
| ------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------- |
| 1 Onboarding        | P1; Loro.dc.html:128–212                       | Built; identity absent                | Auth sign-in/refresh/claim; Sync settings; content manifest/pack                | First use needs no account; bundled starter catalog                      | 59, 61, 67, 71 |
| 2 Add phrases       | P2; Loro.dc.html:222–427                       | Discover/Browse/Import; Add your own and bundled suggest | Content manifest/diff/pack; Sync user_phrase; draft POST /phrases/suggest | Parse, search, review and save locally; live suggest is Q-21 | 61, 65, 68, 97 |
| 3 Phrase detail     | P2; Loro.dc.html:436–581                       | Built                                 | Sync user_phrase edits/tags/love/note/delete; catalog rich fields; draft TTS    | Cached rich content and device TTS; edits immediately local              | 61, 62, 68     |
| 4 Adaptive stream   | P3-01–P3-20; Loro.dc.html:600–677              | Built; no native audio                | Sync outcome/log metadata; CDN model audio                                      | Local queue, playback and applyDelta; no session RPC                     | 60, 62, 68     |
| 5 Speak             | P3-21–P3-30; Loro.dc.html:688–739              | Planned                               | Sync measured outcome metadata; cached model audio                              | On-device ASR/matching; no transcript or audio upload                    | 63, 68         |
| 6 Review            | P3-31–P3-40; Loro.dc.html:750–821              | Planned                               | Sync user_phrase FSRS group and review_log                                      | Local Rust scheduler and grading                                         | 68, 75         |
| 7 Roleplay          | P3A-01–P3A-10; Loro.dc.html:847–949            | Route planned; API stub exists        | POST /ai/scene, GET /ai/themes, POST /ai/coach; Scene/Coach                     | Bundled scenes/tips; generated content needs explicit save               | 76             |
| 8 Memory model      | P3B-01–P3B-08; Loro.dc.html:963–1037           | Planned                               | Sync FSRS/review history only                                                   | Curves and schedules computed locally from real state                    | 60, 75         |
| 9 Pronunciation lab | P3C-01–P3C-08; Loro.dc.html:1051–1110          | Planned, DSP gate                     | Content reference assets; Sync take metadata                                    | Scoring and recordings local; unavailable scores null                    | 61, 77         |
| 10 Prosody lab      | P3D-01–P3D-14; Loro.dc.html:1124–1291          | Planned, DSP gate                     | Reference downloads; Sync take and progress fields                              | Native PCM handles never cross HTTP; Rust DSP                            | 61, 77         |
| 11 Today            | LB-01–LB-10; Loro.dc.html:1316–1391            | Built                                 | Sync refrain_day, streak_day, user_phrase; cached catalog/audio                 | Frozen daily set, waves and counts local                                 | 59, 64, 68     |
| 12 Refrain          | LB-20–LB-32; Loro.dc.html:1405–1532            | Built; no native speech               | Sync outcomes, latency_sample, refrain_day                                      | Every rep is local; only real measurements sync                          | 64, 68         |
| 13 Run              | Loop C; Loro.dc.html:1572–1694                 | Planned, Q-05 gate                    | Sync outcomes/session metadata; no draw/scoring RPC                             | Local engine and ladder                                                  | 68, 78         |
| 14 Phrasebook       | Loop C; Loro.dc.html:1708–1767                 | Planned, Q-05 gate                    | Sync user_phrase; catalog downloads                                             | Local collection and ladder derivation                                   | 68, 78         |
| 15 Progress         | P4-01–P4-08; Loro.dc.html:1787–1876            | Built                                 | Sync outcome/history/day records                                                | Local counts, mastery, milestones and streak; no dashboard endpoint      | 60, 68         |
| 16 Arrival          | Phase 5; Loro.dc.html:1897–1923                | Planned, Q-07 gate                    | draft Trip sync                                                                 | Local calendar dates and explicit trip creation                          | 69             |
| 17 Countdown        | Phase 5; Loro.dc.html:1930–1954                | Planned, Q-07 gate                    | draft Trip sync; pack prefetch                                                  | Countdown/readiness calculated locally                                   | 61, 69         |
| 18 Daily drop       | Phase 5; Loro.dc.html:1961–1980                | Planned                               | draft TripDrop/TripPhrase sync; versioned drop resources                        | Local unlock planner, explicit add; no server unlock RPC                 | 61, 69         |
| 19 Widget           | Phase 5; Loro.dc.html:1988–2007                | Planned                               | Indirect synced trip/progress + cached audio                                    | Native local snapshot, no widget API or v1 push                          | 70             |
| 20 Survival         | Phase 5; Loro.dc.html:2016–2029                | Planned                               | Pack/audio prefetch; draft trip phrase usage sync                               | Cached content usable in airplane mode regardless of billing outage      | 61, 69, 70     |
| 21 Souvenir         | Phase 5; Loro.dc.html:2037–2057                | Planned, Q-07 gate                    | draft Trip completion and usage sync                                            | Local aggregation/export; no server-generated learner scores             | 69             |
| 22 Open chat        | P3E-01–P3E-18, AI-05; Loro Chat.dc.html:95–328 | Planned, Q-16/Q-18–Q-20               | draft POST /chat/turn; authored topic resource downloads                        | Bundled graph; raw thread private/local; explicit saved phrase sync only | 61, 82, 83     |
| 23 Inspector        | P3E; Loro Chat.dc.html:331–449                 | Planned                               | draft ChatTurn feedback; Translate; no message-history API                      | Local turn evidence/glosses/alternatives; save is explicit               | 82, 83         |

## Supporting functionality

| Function                   | Requirements / source                                        | Current state                               | Contract / integration                                                                                       | Offline / failure behavior                                                                      | Owner plan |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------- |
| Auth and account claim     | F-01/F-02/F-07; security-privacy.md, sync-protocol.md        | Provider identity in plan 89; claim missing | Apple/Google, magic-link request/verify, refresh, authenticated claim                                        | Retain local data/outbox on all failures; anonymous installation ID is not authority            | 67         |
| Device/account management  | F-07; plan 67                                                | Missing, transport proposal                 | draft account read, device list/revoke, logout                                                               | Local sign-out preserves unsent learner data; server revocation waits for connectivity          | 67         |
| Sync                       | F-01/F-02/F-04; sync-protocol.md                             | Unscoped in-memory API only                 | Push/Pull; per-entity value schemas, tombstones, opaque cursor, per-op result                                | Queue writes; retry only pending ops; preserve quarantined data                                 | 54, 66, 68 |
| Content and assets         | F-04, content-model.md, ADR-0009                             | Bundled manifest/diff/query-pack            | Manifest/Diff/Pack/full Catalog; resource descriptors for scenarios, drop schedules, chat topics, references | Bundled baseline; atomic update/checksum; never discard usable cache on failure                 | 61         |
| Import/Capture translation | P2-07/P2-09/P2-10/P2-15, AI-03; plan 65                      | Missing                                     | POST /ai/translate text only                                                                                 | Local parsing/OCR; optional translation with unavailable provenance                             | 65, 76     |
| TTS                        | AS, audio-speech.md, Q-15, Q-22, plans 98/99      | Fail-closed listening-class render; empty approved roster | POST /tts/render with voice id, model pin, asset class; checksum-addressed **metadata** + native download | Device TTS and existing cached catalog files; no recording endpoint; neural share-out-of-app is Q-22 | 61, 62, 86, 98, 99 |
| Settings                   | F-05/F-06/F-09; plan 71                                      | Small local schema                          | Sync account-scoped preferences; exclude local permission/download/credentials                               | Local settings immediately usable                                                               | 59, 68, 71 |
| Analytics                  | F-08; metrics.md event taxonomy                              | Missing                                     | POST /analytics/batch; per-event allowlisted props and replay identity                                       | Consent-aware local queue; no learner text, recordings or arbitrary props                       | 71         |
| Remote flags/experiment    | F-08; plan 71, Q-05                                          | Missing, draft                              | GET /config; version/expiry/typed assignments                                                                | Cached valid assignment or disabled safe defaults; no active cohort invented                    | 71         |
| Purchases and entitlements | monetization.md, plan 74, Q-08/Q-12                          | Missing, draft                              | Verify/read/restore entitlement; webhook integration boundary                                                | Signed/versioned cache and grace; Survival continues                                            | 74         |
| Export and erasure         | F-07; security-privacy.md, plan 67                           | Missing                                     | Account export creation/status; DELETE /account                                                              | Cloud export waits online; private local chats must be added locally, never fetched from server | 67, 82     |
| Staff enrichment           | AI-04; content-authoring.md, ai-services.md                  | Tooling stub                                | POST /ai/enrich with staff authorization                                                                     | Manual authoring; human approval before catalog publication                                     | 61, 76     |
| Health/readiness           | F-04; backend.md                                             | Two routes                                  | Current Health/Readiness; planned dependency checks                                                          | Liveness independent of downstream failures                                                     | 66, 73     |
| Navigation/resume          | NAV-01–NAV-16; Navigation.dc.html:38–873                     | Today shell; others stack                   | No endpoint; local ongoing/session checkpoint state                                                          | Never waits for network                                                                         | 56, 59, 81 |
| Notifications/widgets      | notifications requirements; widgets-notifications.md:135–145 | Native modules missing                      | No v1 push registration or delivery endpoint                                                                 | All v1 notifications scheduled locally                                                          | 70         |

## Boundary decisions

- Sync metadata does not include PCM, files/paths, buffer handles, embeddings or ASR transcripts.
  `take` is a measured-result record, not an upload slot. Legacy consent fields do not override
  this.
- Local permission state, download paths, credentials and raw chat threads never enter ordinary
  sync.
- Target request objects are strict. Response parsers tolerate additive fields except
  privacy-sensitive structures, which are allowlisted. Unknown sync fields are rejected, not
  stripped into a valid op.
- Unresolved product semantics remain explicit draft exports. Current wire artifacts preserve
  current behavior, including weaknesses; target artifacts describe desired validation, not deployed
  guards.

Plan 89 adds [implemented Google/Apple identity](google-apple-auth.md) and `/account`; account claim
and learning sync remain separate from this provider flow.
