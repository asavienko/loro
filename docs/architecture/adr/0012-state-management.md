# 0012 · Zustand for session state, live SQLite queries for everything durable

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Mobile lead

## Context

Loro has an unusual state characteristic that shows up all over the blueprint: **the same phrase is
editable from six different screens, and every change must be visible everywhere immediately.**

- Rate a phrase Difficult in the stream → the queue reorders live, the Up-next pill changes, and the
  Progress screen's "what's tricky" histogram updates.
- Tag a phrase `pron` in the add sheet → the next review card becomes a say-it-out-loud card with a
  different focus banner.
- Mark learned in the detail screen → it leaves the stream, and the mastery bar shifts.

The blueprint solves this by holding one shared store at the root and passing accessors into every
sub-component (`Loro.dc.html:3598–3605`). The app needs the same property with real persistence.

Three tiers of state exist:

| Tier          | Example                                             | Must survive  |
| ------------- | --------------------------------------------------- | ------------- |
| **Durable**   | phrases, ratings, tags, FSRS state, trips, settings | everything    |
| **Session**   | current rep index, revealed words, engine phase     | backgrounding |
| **Ephemeral** | sheet open, toast, scroll, animation values         | nothing       |

## Options considered

### A · Redux Toolkit + RTK Query, DB as a cache

**Pros** Familiar; devtools; explicit. **Cons** Two copies of every phrase — one in SQLite, one in
the store — with an invalidation layer between them. That's the exact bug factory this app cannot
afford: a stale phrase list on the Progress screen after a rating change in the stream. Also a lot
of boilerplate for a small team.

### B · TanStack Query over repository functions

**Pros** Excellent server-state ergonomics; caching and invalidation solved. **Cons** It's designed
for _server_ state. Ours is local and authoritative ([ADR-0003](0003-offline-first-sqlite-sync.md))
— there is no remote to be stale against. We would be using a cache-invalidation library to manage
data that is never stale, and every mutation would need explicit `invalidateQueries` calls, which is
precisely the step people forget.

### C · Zustand for session state, live SQLite queries for durable state

**Pros**

- **One copy of durable truth.** Screens subscribe to the DB; a write propagates automatically. No
  invalidation calls to forget.
- Zustand is tiny and unopinionated — right-sized for per-engine session slices.
- Live queries over `op-sqlite` are synchronous through JSI, so the hot path has no bridge hop
  ([performance.md](../performance.md#data-layer)).
- Matches the blueprint's own architecture: one shared store, many views.

**Cons**

- Live-query granularity matters — a badly scoped subscription re-renders too much.
- Two mechanisms to learn instead of one.

## Decision

**Option C**, with strict boundaries.

### Durable state — read, never mirrored

```ts
// A screen subscribes to the database. There is no phrase array in a store.
const phrases = useLiveQuery(
  db
    .select()
    .from(userPhrase)
    .where(and(eq(userPhrase.learned, false), isNull(userPhrase.deletedAt))),
)
```

Every write goes through a repository, which updates the row **and** appends an outbox row in one
transaction ([sync-protocol.md](../sync-protocol.md)). Live queries then push to every subscriber.

### Session state — Zustand, one slice per engine, persisted

```ts
interface RefrainSessionState {
  setId: string
  phraseIndex: number
  repsByPhrase: Record<string, number>
  phase: 'rep' | 'locked' | 'done'
  lastLatencyMs: number | null
}
```

Written to `session.state_json` on every transition, so a crash five reps into a phrase resumes
rather than restarts. That matters more than it sounds: a learner who loses five reps of effort will
not redo them.

### Ephemeral — React state and Reanimated shared values

Never in a store, never persisted.

### The three prohibitions

1. **No durable field lives in a Zustand store.** Difficulty, tags, `reps` — DB only.
2. **No `useState` copy of a list a screen also subscribes to.**
3. **No "refresh" function.** If a screen needs one, its data isn't coming from a live query, and
   that's the bug.

Enforced by review, plus an ESLint rule flagging `useState` initialised from a repository call.

## Consequences

### Good

- Re-rating a phrase in the stream updates the Progress histogram with no code connecting the two.
  This is the single behaviour that makes the app feel like one object graph rather than several
  screens — the property the blueprint's shared store gives it.
- No invalidation bugs, because there is no cache.
- Very little boilerplate; a new screen is a query and a component.
- Synchronous reads on the hot path.
- Engine session state is persisted, so interruptions are recoverable — which is also what the
  conformance suite's interruption-safety test checks
  ([practice-engines.md](../practice-engines.md#conformance)).
- Tests can write to the DB and assert a rendered component updated, exactly as in production.

### Bad — accepted deliberately

- **Live-query scoping needs care.** A subscription selecting all phrases re-renders on any phrase
  change. Mitigated by narrow queries with the partial indexes in [data-model.md](../data-model.md),
  and by memoising row components.
- Two state mechanisms to learn. Mitigated by the boundary being unambiguous: durable → DB, session
  → Zustand, ephemeral → React.
- No time-travel devtools for durable state. In practice the DB _is_ the debuggable artefact — a
  `.sqlite` file pulled from a device explains a bug better than an action log.
- Zustand's flexibility means session slices can drift in shape. Mitigated by typing each slice and
  keeping them next to their engine.

### Revisit if…

- Live-query performance degrades at the 2 000-phrase design target beyond what narrowing and
  memoisation fix. The fallback is a thin in-memory index maintained by the repository layer — still
  one source of truth, but with a derived read model.
- We add a genuinely server-owned data surface (shared phrasebooks, a social feed), which would be
  real server state and would justify TanStack Query _for that surface only_.
