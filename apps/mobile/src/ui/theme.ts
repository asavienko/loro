// The web prototype's design tokens (its src/index.css @theme), for React Native: paper, ink and
// one terracotta. Terracotta fill means play or the one primary action; a selected state is ink.
// Sizes are the web's rem values at 16 px, and scale with the system text size as the web's do.

export const colors = {
  surface: '#fcf9f4',
  surfaceDim: '#dcdad4',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f3ee',
  surfaceContainer: '#f0ede9',
  surfaceContainerHigh: '#ebe8e3',
  surfaceContainerHighest: '#e5e2dd',
  onSurface: '#1c1c19',
  onSurfaceVariant: '#57423b',
  inverseSurface: '#31302d',
  inverseOnSurface: '#f3f0eb',
  outline: '#8a726a',
  outlineVariant: '#dec0b7',
  hairline: '#e6dfd7',
  primary: '#7f2500',
  onPrimary: '#ffffff',
  primaryContainer: '#9f3c16',
  onPrimaryContainer: '#ffc9b7',
  primaryFixed: '#ffdbcf',
  primaryFixedDim: '#ffb59c',
  onPrimaryFixed: '#390c00',
  secondary: '#635d59',
  secondaryContainer: '#eae1db',
  secondaryFixedDim: '#cdc5c0',
  tertiary: '#3a492c',
  tertiaryContainer: '#516142',
  tertiaryFixed: '#d6e9c1',
  onTertiaryFixed: '#111f07',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  /**
   * Music's night (plan 106): songs and albums sit on warm dark ink, so the music side never reads as
   * the phrase side. Terracotta's light tint is its accent.
   */
  night: '#211b18',
  nightContainer: '#2d2521',
  nightContainerHigh: '#3a302b',
  onNight: '#f6efe9',
  onNightVariant: '#c8b8ae',
  nightAccent: '#ffb59c',
  nightOutline: '#54463f',
  /** The sheet and dialog backdrop: on-surface at 40%. */
  scrim: 'rgba(28,28,25,0.4)',
} as const;

export type ColorName = keyof typeof colors;

/** Type roles: size and line height in px (web rem × 16). */
export const type = {
  caption: { fontSize: 11, lineHeight: 15 },
  label: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 14, lineHeight: 20 },
  row: { fontSize: 15, lineHeight: 21 },
  field: { fontSize: 16, lineHeight: 22 },
  title: { fontSize: 18, lineHeight: 23 },
  heading: { fontSize: 20, lineHeight: 26 },
  displaySm: { fontSize: 24, lineHeight: 30 },
  display: { fontSize: 28, lineHeight: 32 },
} as const;

export type TypeRole = keyof typeof type;

export const iconSize = { xs: 16, sm: 18, md: 20, base: 22, lg: 26, xl: 28, '2xl': 34, '3xl': 40 } as const;

export const radius = { lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 999 } as const;

/** Warm shadows: small controls on a surface, covers, and what floats over the page. */
export const shadow = {
  card: { shadowColor: '#57423b', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cover: { shadowColor: '#57423b', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  float: { shadowColor: '#31302d', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const;

/** The smallest target a finger gets (WCAG 2.5.5 at 44 px, as the web's tests hold it). */
export const TARGET = 44;
