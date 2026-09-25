// Button looks, as class strings: a button keeps its own element, name and handlers, and adds
// placement (margins, width, self-*) after the constant, never another size or colour.
// Terracotta fill is for play or the one primary action on a screen; the rest is tonal or text.

/** The primary action: a 48 px terracotta pill. */
export const btnPrimary =
  'min-h-12 px-5 rounded-full bg-primary-container text-on-primary font-bold inline-flex items-center justify-center gap-2 active:opacity-90 disabled:opacity-40';

/** The primary action inside a list, card or empty state: 44 px, body text. */
export const btnPrimarySm =
  'min-h-11 px-4 rounded-full bg-primary-container text-on-primary text-body font-bold inline-flex items-center justify-center gap-1.5 active:opacity-90 disabled:opacity-40';

/** A secondary action: a quiet tonal pill. */
export const btnTonal =
  'min-h-11 px-4 rounded-full bg-surface-container-high text-on-surface text-body font-semibold inline-flex items-center justify-center gap-1.5 active:bg-surface-container-highest disabled:opacity-40';

/** A text action or link-like button: terracotta text, no fill until pressed. */
export const btnText =
  'min-h-11 px-3 rounded-full text-body font-semibold text-primary-container inline-flex items-center justify-center gap-1 active:bg-surface-container';

/** A 44 px round icon button; give it a text colour and an aria-label. */
export const btnIcon = 'w-11 h-11 shrink-0 rounded-full inline-flex items-center justify-center active:bg-surface-container';
