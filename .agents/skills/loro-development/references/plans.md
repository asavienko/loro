# Plan management

Use this reference when creating, reviewing, updating or archiving Loro plans, including status
updates made while implementing an owning feature. Repository conventions in `CLAUDE.md` remain
authoritative. A request to review or organize plans does not authorize implementing their features.

## Find or create the owner

- Start with [active plans](../../../../plans/README.md) and search filenames under all of `plans/`
  with `rg --files plans`. Consult [the archive index](../../../../plans/archive/README.md) for
  completed records and historical snapshots. A missing former path is not a missing plan.
- Update the existing owner instead of duplicating its unfinished scope. When an archived snapshot
  names a current owner, follow that owner. User-archived partial plans can still own remaining
  work.
- For a new plan, inspect active, archived and untracked IDs, and concurrent worktrees when
  relevant. Allocate above the highest assigned number; never reuse gaps or hardcode the next ID in
  this skill. Use `plans/NN-topic.md`, include requirement IDs, scope, dependencies and acceptance
  criteria, and add its row to the active index. Durable specifications belong in `docs/`.

## Maintain honest status

Update the plan's header status and active-index row together as coherent implementation slices
land. Record what was implemented, actual validation evidence, remaining work and its named gates.

| Status | Use when                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `—`    | Implementation remains; identify technical prerequisites for starting it.                                                            |
| `🟡`   | Work is in progress or partially implemented; state what remains and what blocks it, or that nothing external blocks the next slice. |
| `⛔`   | A named decision or evidence gate blocks the stated slice; preserve any independent work that can proceed.                           |
| `✅`   | The recorded scope and its acceptance criteria are complete, with evidence; archive it in the same change.                           |

Implemented runtime with outstanding required device, linguistic or service acceptance stays
partial. A merged PR, passing browser suite or archive location alone is not completion evidence. Do
not shrink acceptance criteria or silently transfer unfinished work just to mark a plan done.

## Finish a plan

When the recorded scope and acceptance criteria are complete, **archive the plan in the same
change**. Do not leave a finished plan in `plans/` or as an active-index row.

```bash
node .agents/skills/loro-development/scripts/archive-plan.mjs --date YYYY-MM-DD <id>
```

The helper moves the file to `plans/archive/<date>/` and rebases Markdown links plus `plans/NN-`
path references. Then:

1. Confirm the moved record is `✅` with evidence.
2. Remove its row from the active index and list it in `plans/archive/README.md` and the dated
   archive index.
3. Update remaining CLAUDE.md / guidance claims if they named the old path or count.
4. Leave no compatibility symlink, redirect file or duplicate at the former path.

For a user request to archive implemented-but-unfinished plans, pass `--unfinished`. That keeps the
partial/blocked status, inserts a disposition note, and leaves remaining-work rows in the active
index with direct archive links. Archiving is not completion.

Helper tests: `node --test .agents/skills/loro-development/scripts/archive-plan.test.mjs`.

## Archive without clutter

1. Move a completed plan to `plans/archive/YYYY-MM-DD/` using the archival date. Preserve its ID,
   filename, implementation record and original completion date. Plan 53 has no original-path
   exception; its former protection was retired at user request. Use the helper above rather than
   hand-moving files.
2. Remove its row from the active index and list it in `plans/archive/README.md` and the dated
   archive index. Keep completed records out of the top-level plan directory and active roadmap.
   Dependencies may still refer to completed work by ID or direct archive link.
3. Update inbound Markdown links and plain path references throughout the repository, including
   source comments, instructions and historical documents. Rebase the moved file's outbound relative
   links from its new directory; preserve fragments. Leave no compatibility symlink, redirect file
   or duplicate at the former path. Preserve the unrelated `AGENTS.md` symlink.
4. If the user explicitly archives an unfinished plan, retain its partial/blocked status and a
   direct link from the remaining-work roadmap. Label it as unfinished in the archive. Superseded
   snapshots likewise retain their history and point to the actual current owner; archiving is not
   completion.

## Verify and finish

Check that affected links resolve, no references rely on removed paths, moved records retain their
evidence, and completed plans have no top-level files or active-index rows. Preserve unrelated
authored artifacts and historical claims; a dated note can explain a later location change. Update
repository guidance if the plan convention changes. Run scoped formatting, `git diff --check` and
the checks required by [validation](validation.md), then commit the coherent change. Report what was
moved or updated and any remaining gates; distinguish local commits from merged/pushed changes.
