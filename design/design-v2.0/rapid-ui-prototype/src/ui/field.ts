/**
 * A text field or select: white with an `outline` edge (4.3:1, so the box is findable: WCAG 1.4.11
 * asks 3:1) and 16 px text, which keeps iOS from zooming in. A caller may add width, a side
 * padding for an icon (pl-11) or the target-language face; nothing else.
 */
export const fieldClass = 'min-h-12 px-4 rounded-2xl bg-surface-container-lowest border border-outline text-field text-on-surface placeholder:text-secondary';
