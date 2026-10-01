// How much room a screen gives its words. A foldable's cover screen is about 344 dp wide, and larger
// system text takes room as surely as a narrower screen does: 344 dp at 130% text holds what 265 dp
// holds at 100%. A compact screen keeps every word whole: it drops what only decorates, and gives a
// label a line of its own rather than squeezing it.

/** Under this many dp of width at 100% text, a screen is compact. */
export const COMPACT_ROOM = 380;

/** The window's width as its text sees it: the width at 100% text size. */
export function roomOf(width: number, fontScale: number): number {
  return width / Math.max(1, fontScale);
}

export function isCompact(width: number, fontScale: number): boolean {
  return roomOf(width, fontScale) < COMPACT_ROOM;
}

/**
 * What the player's page holds under its picture at 100% text: the phrase (two lines and its
 * meaning), the loop's instruction (two lines) and its times grow with the text; its actions, steps
 * and the gaps don't.
 */
const PLAYER_TEXT = 152;
const PLAYER_FIXED = 156;
/** The smallest the picture gets; with less room than that, it gives its place to the words. */
export const MIN_PLAYER_ART = 88;

/**
 * The player's picture, a music player's cover: as wide as the page where there is room, smaller on
 * a short screen or with large text, so the phrase and the loop fit above the controls without
 * scrolling; none at all (0) where even its least would push them off the screen. `stage` is the page's height between the header and the controls; `extraText`, more
 * words at 100% text (the coach's line). The words are reckoned at their usual most, not measured,
 * so the picture keeps its size as they change.
 */
export function playerArtSize(width: number, stage: number, fontScale: number, extraText = 0): number {
  const room = stage - PLAYER_FIXED - (PLAYER_TEXT + extraText) * Math.max(1, fontScale);
  return room < MIN_PLAYER_ART ? 0 : Math.round(Math.min(width, room));
}
