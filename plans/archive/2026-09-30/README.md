# Archived plans — 2026-09-30

On 2026-09-30 the v2.0 player became the app in `apps/mobile` (plan
[104](../../104-prototype-react-native.md)), and the first app, the design packages and the v2.0 web
prototype were removed (Git history at `52a0e3b`). These plans were archived in that change.

| Plan                                     | Why archived                                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [100](100-ui-design-system.md)           | The first app's UI interaction kit; its components and routes were removed. Collides with archived hygiene 100 (unresolved; neither reused). |
| [103](103-prototype-phrase-generator.md) | Implemented in the web prototype; the logic moved to `apps/mobile/src/shared/generate/`. Native UI is 104's; a live writer route is 97's.    |
| [105](105-prototype-phrase-notes.md)     | Implemented; notes content and rules live in `apps/mobile/src/shared/` and the app's player shows them. The live writer run goes with 103.   |

Numbers are never reused. The next new plan is 106.
