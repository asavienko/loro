# Testing recovery drill record

Use this record only after an isolated testing recovery drill. It is evidence, not a procedure or an
assertion that an untested backup is restorable. Do not include secrets, database rows, learner
text, tokens, signed URLs or raw logs.

- Date and operator:
- Scope: nightly or pre-migration bundle; synthetic fixture set only:
- Source bundle identifier and UTC creation time:
- Recorded API and database image identifiers:
- Separate recovery-storage location/owner (no URL or credentials):
- Integrity-verifier command, exit status and UTC time:
- Isolated destination identity (not the active database):

## Checks performed

Mark each as passed, failed or not run, with a short redacted evidence reference.

| Check                                                         | Result | Evidence reference |
| ------------------------------------------------------------- | ------ | ------------------ |
| Copy retained outside the active host                         |        |                    |
| Bundle verifier and checksums passed                          |        |                    |
| Required role/grant recreated from encrypted source           |        |                    |
| Custom-format dump restored with `--exit-on-error`            |        |                    |
| Recorded API image passed readiness against restored database |        |                    |
| Synthetic authenticated tenant-isolation smoke passed         |        |                    |
| Restore duration and backup age recorded                      |        |                    |
| Recovery point and time targets assessed                      |        |                    |

## Result and follow-up

- Overall result: passed / failed / incomplete
- Recovery point and time observed:
- Data or security issue found:
- Follow-up owner and due date:

Do not treat this record as production recovery evidence. Plan 88 owns testing recovery acceptance;
plan 73 selects production objectives only after relevant testing evidence exists.
