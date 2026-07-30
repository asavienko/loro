# Fix the docs that run ahead of the code

- **Requirement IDs:** none — process
- **Milestone:** M1 (cheap, and it stops wasting people's first day)
- **Size:** S
- **Open questions:** Q-11 (rename the blueprint folder?)

## Why a doc bug is worth a plan

This repo's documentation is unusually good and unusually load-bearing: `CLAUDE.md` is loaded into
every session, `docs/` is the spec, and the blueprint outranks both. That makes a wrong line
expensive — it misleads every session and every new engineer that follows, and it costs the most on
day one when nobody has the context to tell doc from reality.

`CLAUDE.md` already names the known drift, which is the right instinct. This plan is about fixing
the sources rather than annotating them.

## The known drift

### 1. `docs/process/onboarding.md` §3 tells you to run commands that do not exist

It says to run `db:migrate` / `db:seed`. Neither is defined — not in the root `package.json` (whose
scripts are `bootstrap`, `check`, `build`, `lint`, `typecheck`, `test`, `format`, `tokens:build`,
`core-rs:*`, `content:*`, `mobile`, `api`, `clean`, `prepare`) nor in `apps/api/package.json`.
`CLAUDE.md` notes `apps/api/README.md` is the accurate one.

Fix: either define the scripts ([api-postgres-persistence.md](13-api-postgres-persistence.md) does
exactly that) or correct the doc. Correcting it now costs minutes; leaving it means every new
engineer hits a dead command in their first hour.

### 2. `apps/mobile/README.md` lists directories that do not exist

It lists `src/features/`, `src/engines/`, `src/domain/`, `src/data/`, `src/platform/`, `modules/`,
and `targets/`. What exists: `src/lib/`, `src/store/`, `src/ui/`.

This one is subtler than a wrong command, because the listed structure is presumably the _intended_
one (`docs/architecture/mobile-app.md#layers` describes layers that are lint-enforced). So the fix
is a decision: mark the structure as planned-with-a-milestone, or restructure the app to match. Do
not leave a reader unable to tell which.

### 3. `docs/process/testing-strategy.md` still presents planned suites as current

`packages/core-rs/tests/` now exists with `parity.rs`, but `sim.rs`, `merge.rs`, and `golden/` do
not. [testing-gaps.md](37-testing-gaps.md) creates them; until then the strategy must label them as
planned rather than imply that one parity test supplies those coverage layers.

### 4. `docs/product/roadmap.md`'s status section will drift by construction

It has a dated "Where we actually are — 2026-07-28" section with a build-state table. That is
genuinely useful and it goes stale silently. Add a convention: the status section names the commit
or the date it was verified, and updating it is part of the definition of done for any
milestone-moving change.

### 5. Test and task counts appear in several places

`CLAUDE.md`, `README.md`, and `roadmap.md` contain point-in-time test/task counts. The first was
updated as tests landed while the others were not, demonstrating the drift this plan is meant to
remove. These numbers change on every PR that adds a test.

Fix by removing the counts or generating them. A number in prose that changes weekly is drift with a
schedule. Prefer "green from a clean clone" over a count.

## The work

1. Fix items 1–3 at the source (correct the doc, or create the thing).
2. Add the verified-date convention to the roadmap status section and to
   `docs/process/definition-of-done.md`.
3. Remove or generate the counts.
4. **Add a drift check for the cheap cases.** CI already has a `drift` job for generated output;
   extend the idea to docs:
   - Every `pnpm` command mentioned in a fenced block in `docs/` and `*.md` exists in some
     `package.json`.
   - Every relative link in `docs/` resolves.
   - Every path referenced in a docs table exists.
   - Every blueprint citation (`Loro.dc.html:NNNN`) points inside the file's actual line count.
     These are all mechanical, and together they catch most of what went wrong above.
5. **Resolve Q-11** — the blueprint folder `Language Learning by Phrases/` has spaces, which is
   awkward for scripts, globs, and CI paths. `design/blueprint/` would be cleaner. Against: it is
   the author's artefact and every doc cites paths into it, so a rename updates all citations in the
   same PR. It is a small, mechanical change that gets more expensive with every doc added — decide
   it now, either way, and close the question.
6. **Keep `CLAUDE.md` honest.** It instructs its own maintenance ("a stale line here misleads every
   session that follows"). As each plan lands, the corresponding `CLAUDE.md` line changes in the
   same PR — several plans here explicitly say so, and the drift check should verify the mechanical
   parts.

## Acceptance criteria

- No doc references a command, script, path, or file that does not exist.
- `apps/mobile/README.md` either matches the tree or clearly marks the structure as planned.
- The roadmap's status section carries a verification date, and updating it is in the definition of
  done.
- Counts are generated or absent.
- The docs drift check runs in CI and fails on a broken link, a missing command, a missing path, or
  an out-of-range blueprint citation.
- Q-11 is decided and closed.
- `CLAUDE.md`'s warnings match reality.

## Tests

The drift check itself. Add a deliberately broken fixture for each of its four checks so the check
is verified rather than assumed.

## Out of scope

Rewriting documentation content. The docs are good; this is about keeping them true.
