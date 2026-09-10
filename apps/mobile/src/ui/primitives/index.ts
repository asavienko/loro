/**
 * Design-system primitives. Nothing here knows what a phrase is.
 *
 * A component that does — one that takes a phrase, a difficulty, a tag — belongs in
 * `src/ui/components/`, and the layer rule at `eslint.config.mjs:83-97` enforces the
 * boundary. The names and prop shapes come from docs/design/component-inventory.md.
 *
 * This is the directory's front door: everything is re-exported here, so
 * `from '../src/ui/primitives'` resolves whether the primitives live in one file or thirteen.
 *
 * ── Accessibility props are set in BOTH forms, on purpose ──
 * react-native-web 0.21 forwards the FLAT `aria-*` props and a handful of deprecated
 * `accessibility*` aliases. It does not read the NESTED objects at all:
 * `accessibilityState` appears nowhere in its `createDOMProps`, and `accessibilityValue`
 * is not mapped either. So on web, `accessibilityState={{ checked }}` and
 * `accessibilityValue={{ now }}` are silently dropped — every radio in the app announced
 * no checked state and every progress bar announced no value, while the source looked
 * correct and the source-scanning gates in `scripts/a11yChecks.ts` had nothing to catch.
 *
 * The nested form is still the canonical one on iOS and Android, so both are set: the
 * object for the platforms the app ships on, the flat `aria-*` for the one the E2E suite
 * can actually inspect. React Native has accepted `aria-*` as aliases since 0.71, so
 * neither form is web-only.
 *
 * When adding an accessibility prop anywhere in this directory, check it against
 * `react-native-web/src/modules/createDOMProps/index.js` — silence is the failure mode.
 * The two components that carry state today are `./Pressable.tsx` (`selected` →
 * `accessibilityState.checked` + `aria-checked`) and `./bars.tsx` (`ProgressBar`'s value).
 */

export { Text, SectionLabel, ChartSummary, type TypeVariant } from './Text'
export { SectionHeader, CardHeader } from './headers'
export { Pressable } from './Pressable'
export { Screen, Card, DarkCard, Divider } from './surfaces'
export { Row, Stack, Grid } from './layout'
export { Button } from './Button'
export { IconButton } from './IconButton'
export { Pill, type PillSize, type PillTone } from './Pill'
export { Chip } from './Chip'
export { Segmented, type SegmentedOption } from './Segmented'
export { Sheet } from './Sheet'
export { ProgressBar, Dots } from './bars'
export { EmojiTile, Dot, StatTile } from './tiles'
export { Field } from './Field'
export { ListRow } from './ListRow'
