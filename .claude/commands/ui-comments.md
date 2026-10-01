---
description: Apply UI comments left in the Playwright browser overlay
argument-hint: [extra instructions]
allowed-tools: mcp__playwright__browser_evaluate, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, Read, Grep, Glob
---

Apply the UI comments I left in the Playwright browser.

1. Read the open comments with `browser_evaluate`, function:
   `() => window.__uiComments?.list() ?? []`
   If the result is empty or `__uiComments` is undefined, tell me and stop.

2. For each comment, find the source that renders `element`. Try, in order:
   `element.react.source` (file:line), `element.react.components` (grep the
   component names, nearest first), `element.testid`, distinctive
   `element.classes`, then `element.text`. If the match is ambiguous, list
   the candidates and ask before editing.

3. Make the smallest change that satisfies the comment. Follow CLAUDE.md
   conventions (design tokens, existing components, styling approach).
   Don't touch unrelated code. `element.styles` shows current computed values.

4. After all edits, open each affected page (current origin + the comment's
   `url`) with `browser_navigate`, take a screenshot, and check every change
   against its comment. Fix anything that didn't land.

5. Mark finished comments resolved:
   `browser_evaluate` with `() => window.__uiComments.resolve([<ids>])`
   Leave skipped or uncertain ones open.

6. End with a short table: id, comment, file(s) changed, status.

Extra instructions: $ARGUMENTS
