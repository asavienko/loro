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

/** The player's picture: 200 dp where there is room, smaller on a narrow or short screen or with large text, never under 112. */
export function playerCoverSize(width: number, height: number, fontScale: number): number {
  const fit = Math.min(width * 0.56, (height / Math.max(1, fontScale)) * 0.24);
  return Math.round(Math.max(112, Math.min(200, fit)));
}
