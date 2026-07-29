# Mobile web E2E

Playwright protects every behavior currently runnable in the Expo app. Tests use the 390×844 mobile
viewport and establish learner state through onboarding; they do not inject Zustand state or depend
on storage that the production app does not have.

```bash
nvm use 22
pnpm test:e2e:install   # once per machine
pnpm test:e2e
```

## Coverage contract

| Implemented route   | E2E owner                | States and transitions protected                                              |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `/onboarding`       | `onboarding.spec.ts`     | redirect, all 6 steps, disabled gates, back/preserved answer, pack seeding    |
| `/`                 | `today.spec.ts`          | finite set, 3 waves, zero stats, all navigation, practice entry               |
| `/add`              | `add.spec.ts`            | search, no matches, scenario, modal/dismiss, tags, add, association, undo     |
| `/add`              | `add.spec.ts`            | Browse’s 8 themes, theme drill-down, return to the grid                       |
| `/phrase/[id]`      | `phrase-detail.spec.ts`  | love, difficulty, tags, hooks, learned toggle, remove, unknown-id empty state |
| `/practice/stream`  | `stream.spec.ts`         | transport, rerating, love, learned count, all-learned empty state             |
| `/practice/refrain` | `refrain.spec.ts`        | 5 phrases × 6 modes, every cue, automaticity, lock-in, completion             |
| `/progress`         | `progress.spec.ts`       | honest zero state, mastery, milestones, tag rollup/drill, post-practice stats |
| all routes          | `route-coverage.spec.ts` | fails when a route is added without being declared in the E2E contract        |

`fixtures.ts` also fails every test that emits a browser console error or uncaught page error.
Selectors use learner-visible roles, labels, and copy so refactors may freely change component
structure while preserving behavior. The `mobile web E2E` job is part of CI's required aggregate;
failure artifacts contain the Playwright report, trace, screenshot, and video.

## Deliberate boundary

This is the cross-platform web behavior gate, not a substitute for native device tests. Audio,
microphone, SQLite hydration, force-quit resume, and airplane-mode behavior do not exist in the app
yet. Their Maestro/device flows remain owned by plans 09–12, 15, 31, and 37. When a new route lands,
add its behavior test and update the coverage table and `coveredRoutes` in the same change.
