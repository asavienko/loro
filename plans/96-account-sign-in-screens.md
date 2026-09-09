# Account sign-in screens and interaction states

- **Requirement IDs:** F-01, F-02; F-05/F-06/F-08 for theme, accessibility and localization.
- **Milestone:** M2, optional account utility.
- **Status:** 🟡 In progress; the method chooser, email/code flow, provider states, confirmation,
  management view and browser/unit coverage are implemented. Native keyboard/provider acceptance,
  visual capture review and live email delivery remain open evidence gates.
- **Reviewed:** 2026-09-09 against `50d0eb1`, including both image boards, their prompts, SVG and
  current account/API/E2E source. No live provider or device acceptance was performed.
- **Depends on:** delivered 67/89/94 account runtime; 56/81/93 shell; 57 controls; 87 localization;
  58/72 device and release harnesses. Dependencies apply to those slices, not whole plans.
- **Number allocation:** 95 is allocated to parallel local CI in another worktree; 96 follows
  inspection of active, archived and concurrent plan files.

## 1. Outcome and ownership

Replace the combined `/account` form with the supplied method chooser, email entry, code entry,
provider feedback and signed-in confirmation. Keep practice optional, local progress durable and
authentication separate from sync completion. Deliver real transitions, including cancellation and
resend, alongside the visual changes.

This plan owns the presentation and interaction increment.
[Plan 67](67-anonymous-auth-and-account-lifecycle.md) continues to own identity, linking, recovery,
export and erasure; [89](archive/2026-09-08/89-google-apple-sign-in.md) records the provider
foundation; [94](94-persistent-practice-and-account-integration.md) owns integrated
account/persistence acceptance. [68](68-sync-and-offline-convergence.md) owns convergence. Reuse
these stacks.

The utility remains outside the 23 authored learner screens. These user-supplied concepts extend its
intended design; the shared spine and named-back rules still follow `Navigation.dc.html:35–40`.
Preserve the original design artifacts. During implementation, update
[F-01 in the functional spec](../docs/product/functional-spec.md#f-01-account) and the
[account catalog entry](../docs/design/screen-catalog.md#account-utility-f-01) to distinguish the
new behavior from the old readiness/form layout.

## 2. Asset inventory and design decisions

Source: [`output/imagegen/account-sign-in-v2/`](../output/imagegen/account-sign-in-v2/).

| Asset                                                                                            | Use                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [account-email-flow.png](../output/imagegen/account-sign-in-v2/account-email-flow.png)           | Five panels: choose method, enter email, enter code, invalid code, signed in.                        |
| [provider-sign-in-states.png](../output/imagegen/account-sign-in-v2/provider-sign-in-states.png) | Five panels: ready, connecting, cancelled, failed, signed in; apply to Google and Apple.             |
| [prompts.md](../output/imagegen/account-sign-in-v2/prompts.md)                                   | Copy, equal method buttons, single code input, optional-practice footer, no connection details.      |
| [provider-states-prompt.md](../output/imagegen/account-sign-in-v2/provider-states-prompt.md)     | Stable button positions, provider-specific progress, enabled cancel action and neutral cancellation. |
| [linked-cards.svg](../output/imagegen/account-sign-in-v2/linked-cards.svg)                       | Transparent vector geometry; contains fixed source colors and large outer padding.                   |
| [linked-cards-ivory.png](../output/imagegen/account-sign-in-v2/linked-cards-ivory.png)           | Raster reference with opaque ivory canvas; not a transparent theme-aware overlay.                    |

There are eight distinct designed states: method-ready and signed-in appear on both boards. Phone
frames, board titles, panel captions and the Apple-equivalence note are not app UI. The card bars
are decorative, not measured progress: hide the hero from assistive technology and never attach
counts or progress semantics to it.

Resolve the following static-design/runtime differences explicitly:

1. Use existing theme tokens, including the learner's accent choice. Orange/ivory is the reference
   appearance, not permission to hardcode a palette or change fonts across the app.
2. Keep one full-width code field labeled **Sign-in code**, with **Enter your code** placeholder.
   The shared contract requires six ASCII digits. Preserve validation, numeric keyboard and OTP
   autofill; do not add six boxes or change the API to variable length. Explain invalid length
   through localized validation rather than the field title.
3. Show submitted email on the code screen as a delivery destination. Only after successful email
   verification may that attempt's email appear in the immediate success view. Clear it on account
   change/sign-out; never reuse a stale draft as identity.
4. Current provider/restored sessions expose account/device IDs, not email. Omit the email line when
   verified display metadata is unavailable. Never insert `you@example.com`, show an internal ID or
   decode an unverified token. Future provider-email display needs a separately reviewed
   verified-profile extension under 67; it does not block these screens.
5. Keep fresh success as shown, with **Back to practice**. On later `/account` entry with an
   existing session, show the same identity treatment plus actual sync status, **Sync now** and
   **Sign out**. This additional management state preserves current functionality without crowding
   confirmation. Reset fresh-confirmation state on departure; it is not a durable user preference.
6. Remove `BackendConnection` and **Check connection** from this flow. Keep backend health utilities
   and operational checks; failures still produce useful inline sign-in/sync feedback. Do not add a
   diagnostics panel to another learner screen as incidental scope. Update the existing
   readiness-specific spec and E2E expectations as an intentional behavior change.

## 3. Verified baseline and gaps

Paths below are repository-relative; proposed files are explicitly labeled.

| Area                                                                    | Current behavior                                                                                                             | Required change                                                                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/app/account.tsx`                                           | Backend status, provider choices and email/code in one view; local `requested` boolean.                                      | Explicit steps, hero, equal outlined method rows, optional footer, feedback slot and success/management views.         |
| `apps/mobile/src/lib/account/client.ts`                                 | Single-flight sign-in/code/refresh admission; generation guards; cancelled status; binding/vault before session publication. | Operation identity and explicit attempt cancellation; retain storage/tenant protections; classify errors by operation. |
| `apps/mobile/src/auth/runtime.ts`                                       | `/auth/providers` discovery; synchronous popup creation; Expo auth session; popup close in `finally`.                        | Attempt-owned cleanup, explicit cancellation, blocked-popup recovery and independent email capability consumption.     |
| `apps/mobile/src/auth/client.ts`                                        | PKCE, state/redirect validation, ticket exchange and `isCurrent` callback.                                                   | Preserve validation and extend cancellation/result information only where needed.                                      |
| `packages/core/src/api/account.ts`                                      | Six-digit verification; returned user has ID/creation instant only.                                                          | Reuse contract; no backend profile expansion for the initial delivery.                                                 |
| `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`               | `/auth/capabilities` includes email; single-use codes; replacement invalidates previous code; server rate limits.            | Consume capability truth and handle resend/rate-limit outcomes; retain server enforcement.                             |
| `apps/mobile/src/lib/account/runtime.ts`, `src/services/accountSync.ts` | Independent pending/syncing/synced/error state and manual sync.                                                              | Keep independent of sign-in confirmation and available in returning-account management.                                |
| `apps/mobile/e2e/accountFlow.ts`, `account.spec.ts`, `states.ts`        | Provider/email/sync/sign-out coverage; helpers assume immediately visible email input.                                       | Traverse separate views; extend failure, navigation and race coverage without losing current data assertions.          |

`Button` already supports loading, but replaces the label with a spinner. The provider row needs
both spinner and visible provider-specific text. Compose existing `Pressable`/`Text` or add a
narrowly tested leading slot; do not change unrelated button loading semantics globally.

## 4. Route and state model

Keep `/account` as the only public route and OAuth callback destination. Email/code are in-memory
steps. Never put email, code, credentials or verifier into URLs or browser storage. Web reload
starts at methods, consistent with memory-only credentials. Native restoration opens management.

Use a discriminated presentation state instead of independent booleans:

- View: `methods | email | code | confirmation | account`.
- Operation: `discover | provider(google|apple) | send | resend | verify | restore | none`.
- Feedback: cancellation/resend acknowledgement, validation, transport/provider failure, unavailable
  capability, storage failure or account mismatch.
- Attempt data: draft email, submitted email, code, attempt ID and active provider.

The account client remains authoritative for session/in-flight admission. A small pure model may
live in proposed `apps/mobile/src/lib/account/flow.ts` with focused tests; the route owns
navigation, focus and rendering. Never duplicate credentials or sync state in the presentation
model. Expose restoration/admission status sufficiently to avoid showing a started request when the
client has declined it because `restoreFlight`/`refreshFlight` is active.

| State / entry          | Layout and actions                                                                                                           | Transition / invariant                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Methods, ready         | Hero, heading/body, Google/Apple/email outlined rows, feedback slot, optional footer.                                        | Provider starts its attempt; email opens entry; footer goes to Today. No email field here.                  |
| Enter email            | Smaller hero, heading, password-free explanation, labeled email input, Send sign-in code.                                    | Validate trimmed address; accepted response freezes submitted email and enters code. Back goes to options.  |
| Sending                | Stable email layout, pending action, no duplicate send.                                                                      | Failure retains draft and shows useful feedback; do not claim delivery before accepted response.            |
| Enter code             | Small hero, destination email, single field, Verify and sign in, Send a new code, Change email.                              | Verify uses frozen submitted email; Back/Change email return to editable entry and clear code/feedback.     |
| Verifying              | Stable code layout; block competing verify/resend/method actions.                                                            | Session accepted locally → confirmation; failure stays with the appropriate actionable feedback.            |
| Invalid code           | Same layout, field-associated warning from board.                                                                            | Editing clears stale validation; resend is available; network failure must not blame the code.              |
| Resending              | Same code screen, pending resend action; no parallel verify.                                                                 | Accepted response clears old code, announces delivery and focuses input; failure retains destination.       |
| Provider connecting    | Active row spinner AND Connecting to Google…/Apple…; other rows disabled; secure-window explanation; enabled Cancel sign-in. | Callback success, external/explicit cancellation or failure. Never embed provider credential/consent forms. |
| Provider cancelled     | Restore available choices; neutral cancellation notice.                                                                      | Any available method retries; cancelled attempt cannot create session/sync.                                 |
| Provider failed        | Restore choices; warm inline warning.                                                                                        | Method buttons are retry actions; no duplicate generic retry button for this error.                         |
| Signed-in confirmation | Hero check, heading, known identity only, capability wording, Back to practice, local footer.                                | Only after binding/credential admission; does not wait for or claim completed sync.                         |
| Returning account      | Identity treatment, actual sync status, Sync now, Sign out.                                                                  | Sync failure retains sign-in/local progress; sign-out returns to methods and keeps learning data.           |

### Back, exit and keyboard

- Keep the shared spine/menu. Configure an account-specific push header without repeating the title:
  methods/confirmation/management show **Today**, email shows **Sign-in options**, code names its
  destination, for example **Email address**. This replaces the board's generic Back with the
  shell's named-back rule. Do not add another spine or duplicate body back row.
- Both practice exit links go to `/`; they do not start a new session, discard checkpoints or change
  the selected course. Respect existing onboarding/home resolution on cold entry.
- Android hardware and in-app back step code → email → methods → Today. Browser back/native swipe
  leaving the route perform the same cleanup as menu/footer departure. If native swipe cannot honor
  cleanup during an active attempt, disable it for that account state while retaining explicit
  controls; do not change other routes' policy.
- Departure invalidates pending work, clears secret drafts, closes/dismisses the attempt-owned auth
  surface where supported, then navigates. Backgrounding into the secure provider window is not
  departure and must not cancel sign-in.
- Move focus to the new heading/input; support email/OTP autofill, paste and single Enter-submit.
  Ensure keyboard avoidance, scrolling and dismissal leave the CTA and exit reachable.

## 5. Async and capability implementation

### Cancellation and admission ordering

1. Add explicit account-client attempt cancellation; do not use sign-out for **Cancel sign-in**.
   Invalidate the attempt synchronously, abort cancellable requests and publish neutral feedback,
   retaining unrelated credentials and local data.
2. Track popup/auth-session ownership per attempt. Old `finally` cleanup cannot close a newer popup
   with the same name. Reject duplicate attempts before opening windows while preserving synchronous
   web popup creation in the initiating click.
3. Audit cancellation during OAuth start, external authorization, exchange and credential admission.
   Late responses cannot bind a different account, persist usable credentials, publish success or
   start sync. The existing generation guard alone is not proof: check ordering around
   `bindAccount`, queued vault writes and publication.
4. Serialize cancellation with credential admission. If cancellation wins, suppress admission and
   best-effort revoke any newly minted server credentials. If admission has already committed,
   publish success and treat later departure as leaving an authenticated screen. Never clear a newer
   attempt's vault record or hide an admitted session behind a cancelled notice. Test vault failure
   and the exact ordering boundary.
5. Guard send/resend/verify results too: back, change email or unmount cannot allow an old request
   to reopen code entry or sign in using a new draft. React StrictMode cleanup must not manufacture
   user cancellation. Preserve shared refresh/restore single-flight behavior.

### Availability and errors

- Use `/auth/providers` for Google/Apple browser OAuth availability. Consume `/auth/capabilities`
  through existing `AuthCapabilitiesSchema` for email. Its Google/Apple flags describe a different
  entry point and must not replace OAuth discovery. Load independently; one failed discovery must
  not suppress a separately known working method.
- Keep three rows in the same order. Disable pending/unavailable methods with readable supporting
  text. All-enabled ready is valid only when capabilities justify it. Cover loading, partial/zero
  availability, failed discovery and unconfigured builds beyond the static boards. A capability
  retry is separate from retrying authentication.
- Resend uses `requestCode(submittedEmail)` and real server limits. The response only returns
  `status: accepted`: do not invent countdowns, cooldowns or expiry estimates. Classify rate-limit
  responses with retry-later copy and release the busy state.
- The server replaces the old code before delivery finishes; failed resend does not guarantee the
  old code still works. Do not promise that it does. Test this and permit another send. Changing
  issuance policy would be a distinct backend change.
- `AccountClient.post` currently maps several HTTP errors to `invalid-code` regardless of operation.
  Introduce operation-aware classification: invalid/expired verification, email validation, provider
  failure, transport, throttling and unavailable service need different messages. Keep
  mismatch/storage errors specific, with existing recovery actions preserved.
- Remove successful connectivity diagnostics. Explain failures without URLs, HTTP codes or
  deployment/security implementation text; local practice remains available.

## 6. Visual implementation and copy

### Components and assets

- Keep `account.tsx` as a composing route with named local `AccountHero`, `MethodChoice`,
  `EmailEntry`, `CodeEntry`, `SignInFeedback`, `SignInConfirmation` and `AccountManagement`
  components/hooks. Promote only actual multi-caller blocks to shared UI. Shared components take
  translated props, never the store or `copy`; avoid a second account service/form framework.
- Reuse `Screen`, `Stack`, `Text`, `Pressable`, `Button`, keyboard avoidance and scrolling. Add
  non-scale geometry to proposed `src/ui/tokens/account.ts`; use minimum height/content growth.
- Adapt the SVG geometry into mobile-owned runtime artwork with token-resolved colors and an
  optional success-check overlay. No SVG renderer is currently declared in the mobile package:
  inspect installed options, then add an Expo-compatible `react-native-svg` only if needed. Preserve
  proportions while tightening outer whitespace intentionally. Never import the concept boards at
  runtime, pretend the PNG is transparent or edit the supplied reference files.
- Use authentic Google/Apple assets and verify current provider brand usage rules during
  implementation. Do not trace generated logos or apply theme accents to provider marks. Use
  existing icon approaches for envelope/check/info/warning; text supplies accessible button names.
- Reserve feedback space to stabilize method rows at default text size. At large text sizes let
  feedback/footer grow and scroll. No fixed phone-height positioning, clipped errors or hidden CTA.
  Use semantic warning/info tokens and contrast-approved text; do not copy raster colors blindly.
- Validate existing accents and theme behavior; this plan does not introduce a new global dark theme
  or font system. Hide decorative illustration/icon details from accessibility.

### Copy inventory

Extend `src/lib/copy.ts` and `src/lib/i18n/en.json`, `bg.json`, `ru.json`, using named ICU
parameters. Update pseudo-locale resources through the existing generation process. English starts
with:

- Your progress, wherever you go; Sign in to keep your phrases and progress together across devices.
- Continue with Google / Apple / email; Keep practising without an account; Your progress stays
  saved on this device.
- Sign in with email; We’ll send you a code. No password needed.; Email address; Send sign-in code.
- Check your email; Enter the code sent to `{email}`; Sign-in code; Enter your code; Verify and sign
  in; Send a new code; Change email.
- That code didn’t work. Try again or request a new one.
- Connecting to `{provider}`…; Complete sign-in in the secure window.; Cancel sign-in.
- Sign-in was cancelled. Choose a method to try again.
- We couldn’t sign you in. Please try again or use another method.
- You’re signed in; You can now sync your phrases and progress across devices.; Back to practice.

Also provide send/resend/verify feedback, resend acknowledgement, email validation, capability and
rate-limit messages, storage/mismatch recovery and returning-account copy. Preserve truthful
local-only sign-out warnings and browser session-lifetime explanation in management/recovery. Do not
log live email, code or credentials in diagnostics or retained test reports.

## 7. Delivery slices and file map

Each slice includes relevant tests/docs, passes `pnpm check` and is committed separately. Use
lower-case requirement IDs in commit subjects. No deployment/publication is included.

| Order | Work / likely files                                                                                                                | Evidence and commit boundary                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Proposed `src/lib/account/flow.ts`, `flow.test.ts`; account client/runtime, auth runtime and unit tests.                           | Model transitions, independent capabilities, operation-aware errors and admission; existing UI stays functional. `feat(mobile): model account sign-in steps (f-01)`. |
| 2     | Account client/auth runtime cancellation and scoped surface cleanup, race tests.                                                   | Cancel during start/popup/exchange/vault admission; newer attempt isolation. `fix(mobile): cancel account sign-in attempts safely (f-01)`.                           |
| 3     | Runtime art, geometry, copy/locales, method/email/code views, account header; E2E helpers/states.                                  | Choose → send → verify, resend/change email, keyboard/back/exit; no old combined form. `feat(mobile): add account email sign-in screens (f-01)`.                     |
| 4     | Provider connecting/cancelled/error UI and safe departures; popup E2E coverage.                                                    | Both providers exercise every designed state without stale sessions. `feat(mobile): show provider sign-in states (f-01)`.                                            |
| 5     | Confirmation and returning-account management; sync/sign-out regressions; remove diagnostics UI; update F-01/catalog/runtime docs. | Honest success/identity fallback, preserved controls and local data. `feat(mobile): add account confirmation and management (f-02)`.                                 |
| 6     | Layout/a11y/pseudo-locale refinements, retained captures, native/service evidence and final status.                                | Complete matrix below, with device/provider limitations explicit. `test(mobile): verify account sign-in screen flows (f-01)`.                                        |

Coordinate `_layout.tsx`, `copy.ts`, locales and E2E manifest with active navigation/settings work.
Recheck main and overlapping files before implementation; preserve unrelated changes. Do not merge
unfinished plans simply to obtain helpers. Shared-control API changes also update actual workbench
specimens and their coverage. Runtime renderer dependencies require native build validation.

## 8. Validation and acceptance

### State inventory and flows

- [x] Register all eight designed states in `e2e/states.ts`, reached through real controls with
      deterministic mocked transport; exercise connecting/cancelled/failed for both providers.
- [ ] Add operational states: discovery pending/failure, partial/zero capability, unconfigured,
      sending/resending/verifying, resend accepted/failed/throttled, invalid email, network failure,
      blocked popup, storage failure/mismatch, returning-account sync states and local sign-out.
- [x] Update `accountFlow.ts` to choose email first and use new labels. Preserve existing transport,
      tenant/device binding, memory-only browser credential, local retention and sync assertions.
- [ ] Cover double taps, resend/verify collisions, change-email late responses, pending navigation,
      old popup cleanup after new attempts, duplicate callbacks and sign-out during sync.
- [x] Confirmation while sync is pending/failed never claims up-to-date progress. Unknown identity
      is omitted. Returning account exposes sync/sign-out; another account cannot adopt local data.
- [x] Sign-out/reload retain course/checkpoints/local changes. Cancellation creates no session or
      sync. In integration, use actual external provider surfaces; no fake consent form or
      production test bypass. E2E fake providers remain transport fixtures only.
- [x] Replace the readiness-panel E2E expectation deliberately; retain backend health unit coverage
      and cover service failure plus the available practice exit in the new account flow.

### Visual, localization and native evidence

- [x] One shared spine, one named back control, at most one filled primary CTA per view. Method rows
      have equal treatment and stable positions while feedback changes.
- [ ] Compare actual captures against both boards at small-phone and larger viewports. Check hero
      bounds, typography, alignment, spacing and scroll reachability using the existing
      `pnpm screenshots` workflow and its current options. Retain a reviewed montage and evidence
      index tied to the implementation commit; mock addresses only in saved captures.
- [ ] Run manifest axe, route coverage and 200%/310% text-scale suites; cover
      English/Bulgarian/Russian and pseudo-locale. Long addresses wrap, actions stay reachable and
      errors associate with inputs.
- [ ] VoiceOver/TalkBack announce progress/feedback once; decoration is silent. Disabled/loading
      state reaches native accessibility and browser ARIA. Color is not the sole warning signal;
      existing touch-target and contrast gates pass.
- [ ] Verify native keyboard/OTP paste/autofill, small displays, safe areas, Android back, iOS
      secure auth return and reduced motion. Browser screenshots do not close native acceptance.
- [ ] Complete real Google/Apple/email delivery tests for supported platforms. Record build, method,
      platform, result and remaining gate without retaining codes or credentials.

### Commands and evidence scope

Use Node 22 and Cargo on PATH; inspect scripts before execution. Run focused model/client/auth tests
during development. Each learner-behavior commit requires `pnpm check` and `pnpm test:e2e`; add
`pnpm test:e2e:workbench` for shared controls, `pnpm test:e2e:bundle` for the production export and
`CI_BASE_REF=origin/main pnpm ci:local` before merge. Server auth/storage changes additionally run
`bash scripts/ci-auth-postgres.sh`; schema changes regenerate/check contracts through existing
tools.

Use an isolated E2E port with `CI=1` and serialize suites sharing output paths. Keep evidence tied
to the exact commit. GitHub Actions stays disabled. Service configuration/deployment remains with
67/86/91 and is not an automatic side effect of UI work. Missing live providers/devices gate their
acceptance slices, not independent implementation.

## 9. Completion, exclusions and planning record

Mark implemented only when the designed/supporting states, preserved management and applicable
evidence are complete. If UI/browser delivery lands first, keep status 🟡 and name missing
native/provider evidence in this plan and the roadmap. Archive only when recorded scope is complete.

Excluded: linking, cross-account migration, profile collection, export/erasure, passwords, new
providers, billing, new auth protocol, sync scheduler replacement, production infrastructure,
provider consent UI and edits to authored artifacts. The provider-email fallback in section 2 is
explicit; no profile implementation or fabricated address is implied.

The browser and client slices are implemented in the working tree. Keep this plan 🟡 until the
remaining visual, native and live-provider evidence is recorded; those gates are independent of
the local UI implementation. Validation evidence for this slice is the account client suite,
mobile lint/typecheck and the six account browser scenarios.
