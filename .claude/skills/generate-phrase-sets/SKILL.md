---
name: generate-phrase-sets
description: Write new phrase sets for a Loro course with the course writer (DeepSeek on Fireworks, plan 112) and wire them to the backend so learners get them — briefs in packages/content/v2/plan, author:run (phrases, judge, translate, judge-translate), every interface language, build:courses, the API seed, voices, deploy. Use when asked to generate, write or add phrases or sets for a course or language pair (e.g. "Polish sets for Russian speakers"), to add an interface language to written sets, or when written sets or their sound don't show up in the app.
---

# Generate phrase sets and ship them

The course writer writes sets offline into shards; the API only serves what `build:courses`
compiled. A set reaches a learner only when **all** of these hold, so check each one:

1. its slot (brief) exists in `packages/content/v2/plan/<code>/<level>/<topic>.json`;
2. `author:run` wrote it (`v2/courses/<code>/<level>/<topic>.sets.json` + `.phrases.jsonl`);
3. it is translated into **every interface language but the course's own** (`<topic>.<bg|ru|pl|cs>.jsonl`;
   English is written with the phrases) — otherwise it is _held_ and never ships;
4. `pnpm --filter @loro/content build:courses` compiled it into `v2/courses.compiled.json`;
5. the API with that file is deployed (its hash is in the content version, so the seed reruns);
6. the server has a voice for the course language and the learner's language
   (`TTS_VOICE_*` in `secrets/ec2-api.enc.env`) — otherwise the player says "No recording of this
   phrase yet".

Background: `plans/112-course-content-at-scale.md` (stages, briefs, spike results),
`docs/architecture/library.md` ("Where content lives", "Phrases spoken by the server"),
ADR-0016/0017. Course codes: `es` es-ES, `bg` bg-BG, `en` en-GB, `us` en-US, `ru` ru-RU, `pl` pl-PL,
`cs` cs-CZ.

## 0. Set up

Follow CLAUDE.md: a new worktree under `.claude/worktrees/<name>` from an up-to-date `main`,
`nvm use 22`, `export PATH="$HOME/.cargo/bin:$PATH"`, `pnpm install --frozen-lockfile`. Recheck plan
112 and `plans/README.md` in case another session is writing the same course.

The writer needs `FIREWORKS_API_KEY` (and `OPENROUTER_API_KEY` as its fallback). Load them into the
environment of the run only, never into a file or the log:

```bash
export SOPS_AGE_KEY_FILE=$HOME/.config/sops/age/loro.txt
plain=$(sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env)
export FIREWORKS_API_KEY=$(printf '%s\n' "$plain" | sed -n 's/^FIREWORKS_API_KEY=//p')
export OPENROUTER_API_KEY=$(printf '%s\n' "$plain" | sed -n 's/^OPENROUTER_API_KEY=//p')
unset plain
```

## 1. Write the briefs

One plan file per course, level and topic: `v2/plan/<code>/<level>/<topic>.json`,
`{"version": 1, "slots": [...]}`. Copy an existing file (`v2/plan/pl/A1/everyday.json`) and follow
`apps/api/src/authoring/slot.ts` (`SlotSchema`, `BriefSchema`):

- `setId` is `set-<code>-<level>-<situation>` (`set-pl-a1-pharmacy`); never reuse an id.
- `topic` must be in `v2/topics.json` (`eating-out`, `getting-around`, `everyday`); a new topic needs
  its titles in every UI language there first. `count` 4–20 (12 is usual); `song: false`.
- `brief`: `scene`, `speakers`, `register`, 1–3 `grammarFocus` points with a rule and an example,
  `functions`, 6–20 `mustUse` lemmas with English glosses, `shouldUse`, `avoid` (lemmas, themes,
  `textKeys: "siblings"`), `mention`, `doNotMention`, `variety`, `notesHints`. Set `"edited": true`
  once a person has read it.
- Lessons from the spikes: don't make irregular verbs must-use words (the Polish matcher can't find
  their forms); too many must-use words about one thing force near-duplicates the judge rejects;
  phrases stay one breath (A1 at most 7 words, 110 characters).

## 2. Write, judge and translate

From `apps/api`, dry-run first (prints every request, sends nothing), then run with a budget:

```bash
cd apps/api
LANGS=bg,ru,cs   # every one of bg, ru, pl, cs except the course's own language
pnpm exec tsx src/authoring/run.ts --course pl-PL --level A1 --topic pharmacy --lang $LANGS --dry-run
pnpm exec tsx src/authoring/run.ts --course pl-PL --level A1 --topic pharmacy --lang $LANGS \
  --limit-usd 1 --run-id pl-a1-pharmacy
```

- With `--lang` the stages are `phrases, judge, translate, judge-translate`; `--stage` picks some
  (`--stage translate,judge-translate --lang bg,cs` adds languages to sets already written, and
  writes only the missing files and lines). `--set <id>` and `--max-sets N` narrow the run.
- The work is derived from the committed shards: a rerun spends nothing on what exists, and nothing
  accepted is rewritten. Never delete or hand-edit a shard to force a rewrite; if a set must be
  rewritten, ask the owner and record why.
- Read the summary: `Written / translated / needs-brief / failed`, cost, and the judge's `reject:`
  and `review:` lines. `needs-brief` means fix the brief (step 1) and run again. For scale, on
  2026-10-02 six Polish sets written, judged and put into Russian cost about $0.035, and nine sets
  put into two more languages about $0.03.
- Read a sample by eye (false friends, calques, wrong register) and record weak lines in plan 112;
  they are for the native reader (Q-23), not for a rerun.

Output: shards under `v2/courses/`, verdicts appended to `v2/reviews/<code>.jsonl`, the run summary
in `v2/runs/<run-id>.json`. All of them are committed.

## 3. Wire them to the backend

```bash
pnpm --filter @loro/content build:courses
```

It rewrites `v2/courses.compiled.json` and prints the sets published per course and every **held**
set with what it lacks (`missing bg-BG, cs-CZ`): translate those (step 2, `--stage translate,judge-translate`)
and build again until nothing you meant to ship is held. Never hand-edit the compiled file; the
content test `src/courses.test.ts` fails while it differs from the shards, and checks that each
set's topic, icons and ids are known and unique.

What the seed does with them (`apps/api/src/library/library.service.ts`, `seedPhrases`): Loro's
sets first, then the writer's, as `origin = 'loro'`; each phrase's notes are written by Loro's
rules (`library/notes`, every note language, `notesBy: 'rules'`) until the writer has a `notes`
stage; the writer's picture is kept; no song in Loro's album. The content version includes the
compiled file's hash, so the deployed server reseeds on its first library request — no seed
revision bump is needed.

## 4. Voices

Every sound is a server clip. For the course and each learner language, `secrets/ec2-api.enc.env`
must have `TTS_VOICE_<LANG>` (Q-15 in `docs/decisions/open-questions.md` lists the pinned voices).
On start the API logs `no voice for …: their phrases have no clips` for any language without one.
To pin a voice: pick it from the ElevenLabs Voice Library (native, standard accent, educational or
narration use, no live moderation), add it to both encrypted envs with `sops` (decrypt to a private
temp file, edit, `sops encrypt --filename-override <file>`, delete the plaintext), to
`apps/api/.env.example`, and record it in Q-15. New clips render on demand (P3-01) within
`LIMIT_SPEECH_RENDERS_DAILY` (500 a day server-wide by default).

## 5. Check, commit, PR

```bash
pnpm check                                   # fast gate; the drift test runs here
pnpm --filter @loro/core-rs build:wasm       # once per worktree, for the PostgreSQL suite
bash scripts/ci-auth-postgres.sh             # the API suite against a disposable PostgreSQL
```

Commit content apart from code (`content(content): …` with `CC-01`/`CC-05`), the compiled file
with the shards it was built from; update plan 112's status and results and `plans/README.md`.
Push and open the PR against `main`.

## 6. Deploy and verify

After the PR is merged, from an up-to-date `main` (the host is not in the repository; see
`docs/process/ec2-deployment.md`):

```bash
# only when secrets/ec2-api.enc.env changed:
sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env |
  ssh ec2-user@$HOST 'sudo install -D -m 600 -o root -g root /dev/stdin /opt/loro/runtime/api.env'
bash scripts/deploy-ec2.sh $HOST /opt/loro/runtime/api.env loro-backend
```

Verify on the server: `GET /v1/library/pack?target=pl-PL` lists the new set ids after Loro's own,
each phrase has `translations` in every learner language and `audio` URLs for the languages with a
voice; `GET /v1/library/speech/<id>.json` answers `rendering`, then `ready`. The app needs no new
build: it downloads the course's pack again when it starts and installs it when the version
changed.
