/** v1.3 daily-rhythm measurements that are not on the space scale. */

/** HTML header inner `h-16`. Spine stays above; no 9:41 chrome. */
export const HEADER_H = 64
/** HTML `px-gutter-sm`. Navigation rail keeps `gutter.default` (20). */
export const PAGE_GUTTER = 16
/** HTML header clusters `gap-space-xs`. */
export const HEADER_CLUSTER_GAP = 4
/** HTML wordmark `tracking-tight` (−0.025em) on the 20px headline-sm face. */
export const WORDMARK_TRACK = -0.5
/** HTML Jump Back In tile `rounded-xl` (0.75rem). */
export const JUMP_RADIUS = 12
/** HTML jump-tile copy `px-2.5 py-1.5`. */
export const JUMP_COPY_X = 10
export const JUMP_COPY_Y = 6
/** HTML jump-tile copy is `flex-col` with no gap. */
export const JUMP_COPY_GAP = 0
export const PROFILE = 44
/** HTML profile hit `ml-0.5` after the streak chip — space['0.5']. Cluster gap stays 4. */
export const PROFILE_ML = 2
export const PROFILE_AVATAR = 32
/** HTML streak chip `px-2.5 py-1 gap-1` / `rounded-full`. Not Pill capsule 11/6. */
export const STREAK_PX = 10
export const STREAK_PY = 4
export const STREAK_GAP = 4
/** HTML target chip `px-2.5`. Same pad as the streak chip. */
export const TARGET_PX = 10
/** HTML fire mark `text-[14px]`. Product keeps the flame glyph, not a 38. */
export const STREAK_FLAME = 14
/** HTML cycle pulse `w-2 h-2` — the well is the dot, not PulseRing's 6 inset. */
export const PULSE_DOT = 8
/** HTML cycle row `gap-1.5` — space['1.5']. */
export const GREETING_CYCLE_GAP = 6
export const STAT_ICON = 32
/** HTML stats `text-[18px]` on the existing cadence / locked / next marks. */
export const STAT_MARK_FACE = 18
export const STAT_DIVIDER_H = 24
/** HTML stats pill `p-space-sm` / `rounded-xl`. */
export const STAT_PAD = 8
export const STAT_RADIUS = 12
/** HTML stats cell `gap-space-xs` — space['1']. */
export const STAT_CELL_GAP = 4
/** HTML stats bar is `justify-between` only — no extra gap between cells. */
export const STAT_BAR_GAP = 0
/** HTML last stats cell (Next Due) `pr-1` — space['1']. */
export const STAT_NEXT_PAD_END = 4
/** HTML greeting section `space-y-space-sm` — Greeting to StatsBar. */
export const GREETING_GAP = 8
/** HTML cycle row `mb-1` — space['1']. */
export const GREETING_CYCLE_MB = 4
/** HTML due line `mt-0.5` — space['0.5']. */
export const GREETING_DUE_MT = 2
/** HTML due `text-body-md` 14 / 22. Runtime bodyMd is 16 / 24. */
export const GREETING_DUE = 14
export const GREETING_DUE_LINE = 22
/** HTML due count span is `text-on-surface font-semibold`. Lead stays secondary. */
export const GREETING_DUE_WEIGHT = '600'
export const JUMP_GAP = 8
export const SECTION_GAP = 32
/** HTML wave-card title `text-headline-sm` 20 / 28 — time sits in that line. */
export const WAVE_TITLE = 20
export const WAVE_TITLE_LINE = 28
/** HTML wave section h2 is the same headline-sm face, not SectionLabel. */
export const WAVE_HEADING = WAVE_TITLE
export const WAVE_HEADING_LINE = WAVE_TITLE_LINE
/** HTML Jump Back In h2 is the same headline-sm face. */
export const JUMP_HEADING = WAVE_HEADING
export const JUMP_HEADING_LINE = WAVE_HEADING_LINE
/** HTML wave manner `text-body-sm` 12 / 18 / `line-clamp-2`. Runtime caption is 14 / 20. */
export const WAVE_MANNER = 12
export const WAVE_MANNER_LINE = 18
export const WAVE_MANNER_LINES = 2
/** HTML waveform `gap-1` — space['1']. */
export const WAVEFORM_GAP = 4
/** HTML wave-card `h3.mt-1` after the badge — space['1']. */
export const WAVE_TITLE_MT = 4
/** HTML title is one headline-sm line. Do not invent a row gap between clock and name. */
export const WAVE_TITLE_GAP = 0
/** HTML greeting `text-headline-lg-mobile` 30 / 36 / −0.015em. */
export const GREETING_TITLE = 30
export const GREETING_LINE = 36
export const GREETING_TRACK = -0.45
/** HTML wave cards are `w-[84vw] max-w-sm`. */
export const WAVE_CARD_VW = 0.84
export const WAVE_CARD_MAX = 384
/** HTML wave-card `rounded-2xl` (1rem). Not HTML `rounded-xl` (12). */
export const WAVE_CARD_RADIUS = 16
/** HTML wave-card `p-space-md`. */
export const WAVE_CARD_PAD = 16
/** HTML wave-card is `justify-between` with no gap. */
export const WAVE_CARD_GAP = 0
/** HTML title cluster `space-y-space-xs` — space['1']. Includes manner. */
export const WAVE_HEAD_GAP = 4
/** HTML waveform `rounded-xl` (0.75rem). */
export const WAVEFORM_RADIUS = 12
/** HTML waveform `p-2.5` — space['2.5']. Height 48 is border-box. */
export const WAVEFORM_PAD = 10
/** HTML waveform `my-space-md`. */
export const WAVEFORM_MY = 16
/** HTML carousel `gap-space-md` and `-mx-gutter-sm`. */
export const WAVE_SNAP_GAP = 16
export const WAVE_BLEED = 16
/** HTML carousel track `pb-2` — space['2']. */
export const WAVE_TRACK_PB = 8
/** HTML wave-card footer `pt-space-xs` — space['1']. */
export const WAVE_FOOTER_PT = 4
/** HTML later card `opacity-60`; passed stays `opacity-80`. */
export const WAVE_LATER_OPACITY = 0.6
export const WAVE_PASSED_OPACITY = 0.8
export const WAVEFORM_H = 48
export const WAVEFORM_BAR_W = 6
export const TILE_THUMB = 56
/** HTML Jump Back In grid is 2×2. Extra real phrases sit below the first fold. */
export const FIRST_FOLD_TILES = 4
export const INSIGHT_ICON = 48
/** HTML insight well `rounded-xl` (0.75rem). */
export const INSIGHT_ICON_RADIUS = 12
/** HTML insight card `p-space-md` / `rounded-2xl` / `gap-space-md`. */
export const INSIGHT_PAD = 16
/** HTML insight section `pb-6` — space['6']. Extra on the section, not the card. */
export const INSIGHT_PB = 24
export const INSIGHT_RADIUS = 16
export const INSIGHT_GAP = 16
/** HTML insight title `font-headline-sm` + `text-body-md` — 14 / 22, not title3 20. */
export const INSIGHT_TITLE = 14
export const INSIGHT_TITLE_LINE = 22
/** HTML insight body `text-body-sm`. */
export const INSIGHT_BODY = 12
export const INSIGHT_BODY_LINE = 18
/** HTML insight well `text-2xl` — real graduated count, not an invented icon. */
export const INSIGHT_COUNT = 24
export const INSIGHT_COUNT_LINE = 32
export const DUE_BADGE_PY = 2
/** HTML Start Wave `px-4 py-2` / `text-label-md`. */
export const START_PILL_PY = 8
export const START_PILL_PX = 16
/** HTML Start Wave `gap-1.5` between play-arrow chrome and the word. */
export const START_PILL_GAP = 6
/** HTML Start Wave play_arrow `text-[18px]` — CTA triangle in an 18 box, not a play control. */
export const START_TRI_FACE = 18
export const PLAY_TRI_W = START_TRI_FACE
export const PLAY_TRI_H = START_TRI_FACE / 2
export const START_LABEL = 12
export const START_LABEL_LINE = 16
/** HTML Start Wave `font-label-md` tracking 0.025em on 12. */
export const START_LABEL_TRACK = 0.3
export const CARD_GLOW = 112
/** HTML `text-label-sm` / `font-bold` is 700. Runtime `labelSm` token stays 500. */
export const LABEL_BOLD_WEIGHT = '700'
/** HTML cycle / wave-badge `tracking-wider` — labelSm 0.05em on 11. Token stands; do not override. */
export const GREETING_CYCLE_TRACK = 0.55
export const WAVE_BADGE_TRACK = GREETING_CYCLE_TRACK
export const WAVE_MIXES_TRACK = GREETING_CYCLE_TRACK
export const STAT_LABEL_TRACK = GREETING_CYCLE_TRACK
/** HTML stats value `font-label-md` 0.75 / 1rem. `font-bold` is 700. captionSm is that step. */
export const STAT_VALUE = 12
export const STAT_VALUE_LINE = 16
/** HTML `font-label-md` tracking 0.025em on 12. */
export const STAT_VALUE_TRACK = 0.3
/** HTML Jump Back In browse `tracking-wider` — labelSm 0.05em on 11. Token stands. */
export const JUMP_BROWSE_TRACK = GREETING_CYCLE_TRACK
/** HTML jump-tile title `font-label-md` 0.75 / 1rem, weight 600. captionSm is that step. */
export const JUMP_TITLE = 12
export const JUMP_TITLE_LINE = 16
/** HTML `font-label-md` tracking 0.025em on 12. */
export const JUMP_TITLE_TRACK = 0.3

export const PROFILE_GLYPH = '●'
export const STAT_CADENCE = '↻'
export const STAT_LOCKED = '✓'
export const STAT_NEXT = '→'

/** Decorative waveform heights — tall, not wide, so they are not read as progress bars. */
export const WAVEFORM_ACTIVE = [16, 32, 20, 36, 40, 24, 32, 28, 36, 16, 24, 12, 28, 16] as const
export const WAVEFORM_IDLE = [16, 20, 28, 16, 32, 20, 12, 24, 20, 28, 12, 16] as const
