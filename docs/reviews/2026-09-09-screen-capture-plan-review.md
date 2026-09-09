# Screen capture implementation against the strengthened plan

**Reviewed:** 2026-09-09

**Implementation reviewed:** `65b64e9..28234cd` (`f33b04a` plus `28234cd`)

**Fixes implemented:** `0a73fb9`

**Status:** R1–R4 are implemented in `0a73fb9`; post-fix capture and lifecycle validation are
recorded below. Restoring the owning numbered plan and completing its visual-sampling record remain
process follow-ups.

**Related learner coverage:** F-06 (light theme), F-08 (defined language states).

**Scope:** The `pnpm screenshots` developer command and its artifacts, not learner functionality.

The pre-fix review found four gaps in interruption handling, incremental artifact validation,
failure reporting and browser provenance. The implementation commit addresses all four while
preserving independent run directories and the existing successful capture behavior.

## Plan provenance

The baseline is **“Generate images of every defined app screen state”**, the strengthened plan in
the **all-screen image command** task, immediately before “implement the plan”. Task ID:
`01a08645-a0d1-70b1-8655-80d17ab13602`; plan turn: `01a08649-85b3-7490-9c15-78fc39056208`.

That plan was recovered from the task history for this review. No corresponding numbered file is
present in the active or archived plan inventory at the reviewed revision. The comparison below
records its requirements; it does not infer them from the implementation. The earlier draft's port
8083 and replacement of the output directory were superseded by port 8086 and independent run
directories. Restoring the owning numbered plan and its remaining acceptance criteria is a process
follow-up under the [repository plan convention](../../CLAUDE.md); this review assigns no new plan
number and does not mark the work complete.

## Comparison with the plan

| Planned behavior                                                                                                 | Assessment at `28234cd`                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root command; unique timestamp/UUID directory; ignored images, manifest, gallery and diagnostics                 | Implemented. Existing collections survive subsequent runs.                                                                                                                                            |
| Every `STATES` entry; reuse `enter`, onboarding, account fixtures and real local persistence                     | Implemented by iteration over the shared manifest. The retained complete collection covers 74 entries.                                                                                                |
| One test per state; one worker; zero retries; 90-second tests; 12-minute run; continue after individual failures | Configuration matches. No `maxFailures` or serial test group stops the collection after an ordinary state failure.                                                                                    |
| Capture tests excluded from learner, production and workbench discovery                                          | Verified with all three configurations' `--list` output.                                                                                                                                              |
| Own Expo server on 8086, validated override, no server reuse, cleanup on interruption                            | Port/configuration portions implemented; targeted SIGTERM does not stop the run (R1).                                                                                                                 |
| Test account endpoint; pseudo-localization disabled; no live account/backend required                            | Configuration pins the fixture endpoint and `EXPO_PUBLIC_PSEUDO_LOCALE=0`; existing account helpers supply the mocked transport.                                                                      |
| Chromium, light theme, normal text scale, en-US, Madrid, scale factor 1                                          | Shared settings plus default browser context behavior match; retained images are 390 × 844.                                                                                                           |
| Fixed displayed time before navigation; running timers; viewport at reached scroll position; no caret/animations | Implemented in the capture test.                                                                                                                                                                      |
| State/font/sheet readiness; no blanket sleep or network-idle wait                                                | Existing state assertions and `document.fonts.ready` are reused. The difficulty-sheet helper already waits for the settled dialog.                                                                    |
| Undo visible before and after capture; incidental toasts absent elsewhere                                        | Implemented. The named Undo exception is local to the capture test; optional capture metadata was not added because the current transient exception is handled directly.                              |
| Route-grouped gallery, ordered states, readable unique names, spec/result/full-size relative links               | Implemented; all 74 links and filenames in the retained successful collection were checked.                                                                                                           |
| Run/fixed time, Git revision/dirty state, browser version, viewport, all expected states                         | All except browser version are recorded (R4).                                                                                                                                                         |
| Passed only after test teardown and PNG validation; incremental results                                          | Test teardown is included in `onTestEnd`; PNG validation is postponed until `onEnd` (R2).                                                                                                             |
| Startup/interruption failure visible; accurate exit status; totals and gallery path printed                      | Normal reporter and port-preflight paths improve this; termination and fallback output remain incomplete (R1, R3).                                                                                    |
| Setup documentation, including Node 22, workspace dependencies and Chromium                                      | Node and Chromium setup, command, port and output are documented. Add the explicit workspace installation prerequisite or a link to the root setup instructions.                                      |
| Full capture, visual sampling, failure/occupied-port/interruption probes, independent runs, checks               | Prior full captures and `pnpm check` are recorded in this task. This review rechecked retained artifacts/discovery and reproduced the failures below. The complete acceptance checklist remains open. |

## Post-review fix status

`0a73fb9` implements every code fix identified here:

- **R1:** The runner owns the direct Playwright process, installs signal handlers before preflight,
  forwards SIGINT/SIGTERM to its process group, gives Playwright an 8-second graceful web-server
  shutdown window, and force-kills the group only as a bounded fallback. The Expo wrapper owns its
  direct child group and applies the same bounded escalation.
- **R2:** A passed state is written only after its PNG exists, has a PNG signature and is exactly
  390×844. The end-of-run validation remains in place for later artifact deletion or corruption.
- **R3:** Preflight, spawn, interruption and reporter finalization use the same totals, error and
  absolute gallery-path summary. Every finalized manifest has `completedAt` and `counts`.
- **R4:** The manifest starts with unavailable browser metadata and the capture fixture records the
  launched browser name and `browser.version()` before state capture.

The only remaining plan follow-ups are restoring the missing numbered plan record and documenting a
representative visual sample; neither is a defect in the command implementation.

## Fix record

### R1 — [P2] Make termination reach and stop the running capture

**Blocking completion of the interruption contract.**

**Implemented in `0a73fb9`.** The launcher and Expo wrapper now use direct Node entry points with
owned process groups, early signal handlers, graceful shutdown and bounded force escalation. The
Playwright web-server config requests graceful SIGTERM shutdown so the detached Expo group can
cleanly stop before fallback termination.

Location: [screenshots-runner.mjs](../../apps/mobile/e2e/screenshots-runner.mjs), lines 35–95,
especially the early signal handlers and `signalProcessGroup`; also inspect process ownership in
[screenshots-server.mjs](../../apps/mobile/e2e/screenshots-server.mjs), lines 15–44.

Before `0a73fb9`, the launcher sent the signal to its immediate `pnpm` child. A real probe started
that launcher from `apps/mobile`, waited for the first passed state, and sent SIGTERM to the
launcher's PID. Ten seconds later the launcher had not exited, the manifest still said `running`,
the passed count had increased from **1 to 7**, and `/onboarding` on its dedicated port still
returned **200**. This was continued capture, not merely a delay while closing resources. The
finding concerned targeted SIGTERM; it did not claim that terminal Ctrl+C behaved identically.

**Suggested change:** give the launcher explicit ownership of the actual Playwright process and its
descendants, avoiding a package-manager signal boundary where possible. Implement supported graceful
cancellation, wait for reporter finalization and server/browser shutdown, and apply a bounded
fallback to the owned processes if they do not stop. Finalize the manifest only after its writers
have stopped so they cannot overwrite an interrupted result. Preserve any unrelated server. Return
nonzero on cancellation.

**Acceptance:** send SIGINT and SIGTERM separately during server startup and after at least one
capture. Both runs must stop producing artifacts, leave a failed/interrupted collection, exit
nonzero within a documented bound, and release their server port. Verify the previous successful
collection is unchanged and an unrelated listener survives. Exercise both the root command and its
launcher entry point.

Reproduction procedure: launch `node e2e/screenshots-runner.mjs` from `apps/mobile` with
`LORO_E2E_PORT=18994`; retain its PID; wait until its new manifest has a passed state; run
`kill -TERM <launcher-pid>`; observe the manifest and port for ten seconds. Use only an unused port
and clean up only processes owned by the probe.

### R2 — [P2] Validate the PNG before publishing a passed state

**Blocking completion of the incremental artifact contract.**

**Implemented in `0a73fb9`.** `onTestEnd` validates the expected PNG before writing `passed`, while
`onEnd` repeats the check as a defense against later artifact changes. Missing and wrong-sized
artifacts retain actionable state-level errors.

Location: [screenshots.reporter.mjs](../../apps/mobile/e2e/screenshots.reporter.mjs), lines 17–37
and 55–61; fallback finalization is in
[screenshots-runner.mjs](../../apps/mobile/e2e/screenshots-runner.mjs), lines 98–121.

Before `0a73fb9`, `onTestEnd` immediately wrote `passed` when the Playwright result passed. PNG
existence and dimensions were checked only when the entire suite ended. A focused reporter probe
with a successful test result and a missing PNG wrote **passed** to the manifest; calling `onEnd`
later corrected it to **failed**. If the reporter did not reach `onEnd`, the launcher's fallback
marked only the run failed and rendered those unvalidated passed entries as image links. Thus a
partial collection could advertise a missing or wrongly sized image as passed, contrary to the
strengthened plan.

**Suggested change:** validate the artifact in `onTestEnd` before persisting a passed status. Keep
the end-of-run check as defense against later deletion/corruption, and apply the same validation
when the launcher finalizes an interrupted run. Preserve actionable errors on the affected state.

**Acceptance:** exercise missing PNG, wrong dimensions and fixture-teardown failure independently.
None may appear as passed in the incremental manifest or interrupted gallery. A valid completed
state should remain visible when a later state fails. Verify that a failing state does not prevent
the next independent state from running.

### R3 — [P3] Print the collection location on every finalization path

**Reporting requirement left incomplete.**

**Implemented in `0a73fb9`.** `finalizeManifest` computes completion time and totals, and
`formatSummary` is shared by the reporter and launcher fallback paths. Preflight failures now show
the same totals and absolute gallery location.

Location: [screenshots-runner.mjs](../../apps/mobile/e2e/screenshots-runner.mjs), lines 43–68 and
98–121; shared finalization is in
[screenshots-artifacts.mjs](../../apps/mobile/e2e/screenshots-artifacts.mjs), lines 39–52.

Before `0a73fb9`, the fallback created a failed manifest and gallery but printed neither their
location nor counts. A controlled probe replaced only the launcher's `pnpm` executable with an
isolated temporary stub that exited zero before running Playwright. The launcher correctly exited
**1** and wrote a failed collection, but both stdout and stderr were **empty**, and
`manifest.counts` was absent. The same fallback was used when the reporter could not finalize. A
developer was left to search the timestamp directories for the diagnostic artifact.

**Suggested change:** share final reporting across normal, preflight, spawn-error and interruption
paths. Always record and print passed/failed/not-run totals, a useful failure reason and the
absolute gallery path; avoid duplicate success output when the reporter already finalized.

**Acceptance:** occupy the port, fail the child spawn, and exit the child before reporter startup.
Each path must return nonzero, retain a reviewable collection, and print its correct totals and
absolute gallery path. Verify the ordinary success summary remains correct.

### R4 — [P3] Record the browser actually used to render the collection

**Reproducibility metadata required by the plan is missing.**

**Implemented in `0a73fb9`.** The initial manifest records browser metadata as unavailable, and the
capture fixture replaces it with the actual Chromium name and version after launch.

Location: [screenshots-artifacts.mjs](../../apps/mobile/e2e/screenshots-artifacts.mjs), lines 17–23,
and [screenshots.capture.ts](../../apps/mobile/e2e/screenshots.capture.ts), lines 20–27.

Before `0a73fb9`, the retained manifest contained only `startedAt`, `fixedTime`, `revision`, `dirty`
and `viewport` under `run`. No setup, fixture or reporter hook added a browser version. Browser
upgrades could alter rendering with unchanged app source, so the artifact did not provide the
planned provenance.

**Suggested change:** record the actual launched browser name and `browser.version()` through a
fixture/attachment or another explicit reporter input. Do not substitute the Playwright package
version for the browser version. A failure before browser launch should record it as unavailable
rather than inventing a value.

**Acceptance:** compare a generated manifest with the version of the browser used by that run; check
that prelaunch failures remain readable with unavailable browser metadata.

## Evidence and remaining validation

These are observations from this review unless explicitly labeled historical:

- **Post-fix full capture:** `test-results/screenshots/2026-09-09T13-58-37-886Z-8319f13c/` contains
  74 passed states, 74 PNGs, no missing or dimension-mismatched artifacts, a route-grouped gallery,
  and `run.browser` set to `{name: "chromium", version: "151.0.7922.34"}`.
- **Post-fix lifecycle probes:** SIGTERM during preflight, SIGTERM after one capture, SIGINT after
  one capture, and SIGTERM after the dedicated server became reachable all exited nonzero within
  0.5–0.6 seconds, finalized failed manifests, stopped their ports, and left no owned capture
  processes. The after-capture runs preserved their passed count and marked the rest not-run.
- **Unrelated listener:** a listener on a separate port remained reachable while an interrupted
  capture was stopped.
- **Post-fix reporter probe:** missing and 1×1 PNGs were marked failed in the incremental manifest
  immediately, with the same state-level error retained by end-of-run finalization.
- **Post-fix preflight probes:** invalid and occupied ports returned nonzero with
  `0 passed, 0 failed, 74 not run` and an absolute gallery path.

- **Source reviewed:** both capture commits and their integrations with `STATES`, fixtures, shared
  browser configuration and the existing sheet readiness helper. No product source changed.
- **Historical successful run rechecked:**
  `test-results/screenshots/2026-09-09T13-39-00-049Z-9e53abf6/`. It contains 74 passed entries, 74
  unique image paths, 74 existing gallery links, and no PNG dimension mismatches. Its manifest
  records the precommit dirty tree used to validate `28234cd`; it is not a fresh postcommit run.
- **Discovery:** learner 168 tests/22 files; production 4 tests/4 files; workbench 5 tests/1 file.
  All three `--list --reporter=list` commands exited zero and excluded `screenshots.capture.ts`.
- **Actual SIGTERM:** run `2026-09-09T13-44-31-262Z-9584dc94`, passed count 1 → 7 over ten seconds,
  manifest `running`, launcher still running, own server HTTP 200. The probe then stopped its owned
  process group; the dedicated port was checked to have no listener. That cleanup is not evidence
  that the command handled cancellation.
- **Focused reporter probe:** a missing PNG was `passed` after `onTestEnd`, then `failed` after
  `onEnd`. This isolates the lifecycle defect; it does not claim Playwright itself generated a
  missing image in the complete historical run.
- **Controlled child-exit probe:** run `2026-09-09T13-45-42-737Z-d51e15ec`, launcher exit 1, failed
  manifest/gallery present, empty stdout/stderr, no counts field.
- Raw local probe outputs are retained in the ignored `test-results/screenshots-review/` folder. The
  concrete results above are retained here so the review survives artifact cleanup.
- **Review document validation:** relative links resolve, scoped Prettier and `git diff --check`
  pass. `pnpm check` exited zero; all 23 Turbo tasks were cache hits. This is the fast repository
  gate, not a new full capture or native acceptance run.

The post-fix probes cover the demonstrated failure cases, occupied ports, SIGINT/SIGTERM during
startup and after a capture, independent run preservation and an unrelated listener. The full
capture and `pnpm check` pass at the source revision recorded above. Rerun `pnpm test:e2e` if shared
state helpers change. The planned visual sample (Today, sheet, onboarding, Cyrillic, account error,
storage loading, Undo, completed practice) is still a documentation follow-up and should be recorded
with a final source revision when that review is performed.

The boundaries remain correct: this exports defined learner states rendered by Expo web. It adds
neither native screenshots nor authored blueprint screens, locale combinations or screenshot
comparison baselines. Those exclusions are not implementation defects.
