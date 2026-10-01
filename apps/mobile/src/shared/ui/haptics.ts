// Touch feedback for the controls: a light tap as a button or row is pressed, a tick as a choice
// changes, a click as a drag reaches the point where letting go acts. On iOS and Android a haptic
// (src/platform/haptics.ts, swapped in by metro.config.js); in a browser nothing — navigator.vibrate
// is a motor buzz, not a tap, and iOS Safari has none. The player's own cues (audio/cues.ts) mark
// its moments; these only answer a touch.

/** A press on a control that acts or opens: a button, a row, a card. */
export function tapHaptic(): void {}

/** A choice changed: a tab, a chip, an option in a list, a like. */
export function selectHaptic(): void {}

/** A switch flipped on or off. */
export function toggleHaptic(_on: boolean): void {}

/** A drag reached the point where letting go acts (a card thrown, a window closed, a row swiped), or left it. */
export function thresholdHaptic(): void {}

/** A row lifted to be dragged, or landed in a new place. */
export function liftHaptic(): void {}
