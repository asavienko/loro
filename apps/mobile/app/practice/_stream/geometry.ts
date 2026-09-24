/** v1.3 listening-queue measurements that are not on the space scale. */

export const COVER = 64
/** Editorial now-playing cover fill — HTML photo is object-cover. Crop past the plate. */
export const COVER_CROP = 2.2
export const COVER_GLYPH = 141
/** Editorial cover `rounded-2xl` (1rem). */
export const COVER_RADIUS = 16
/** Editorial cover `border border-outline-variant/40`. Overlay so the box stays 64. */
export const COVER_BORDER = 1
/** Editorial play `w-9 h-9`. */
export const EDITORIAL_PLAY = 36
/** Simple-queue in-card and sticky-dock play `w-7 h-7`. */
export const SIMPLE_PLAY = 28
/** HTML simple-queue scroll `pb-20`. Room so Up Next sits above the sticky dock. */
export const SIMPLE_FOOTER_RESERVE = 80
/** HTML simple dock `px-4` — space['4']. */
export const SIMPLE_FOOTER_PAD_X = 16
/** HTML simple dock `py-2` top — space['2']. Bottom is the safe-area inset only. */
export const SIMPLE_FOOTER_PAD_TOP = 8
/** Editorial prev/next `w-8 h-8`. */
export const EDITORIAL_TRANSPORT = 32
/** HTML editorial skip `text-xl`. */
export const EDITORIAL_TRANSPORT_FACE = 20
/** HTML simple skip `text-lg`. */
export const SIMPLE_TRANSPORT_FACE = 18

export function compactTransportFace(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_TRANSPORT_FACE : EDITORIAL_TRANSPORT_FACE
}
/** Editorial hero card `p-3.5`. */
export const EDITORIAL_PAD = 14
/** Simple-queue hero card `p-3`. */
export const SIMPLE_PAD = 12
/** Editorial hero `rounded-3xl`. */
export const EDITORIAL_RADIUS = 24
/** Simple-queue hero `rounded-2xl`. */
export const SIMPLE_RADIUS = 16
/** Simple-queue cover `rounded-xl` (0.75rem). Editorial cover stays `rounded-2xl`. */
export const SIMPLE_COVER_RADIUS = 12
/** Simple-queue phrase `text-[1.1rem]`. */
export const SIMPLE_TITLE = 17.6
/** Tailwind `leading-tight` on that 1.1rem face. */
export const SIMPLE_TITLE_LINE = 22
/** Simple-queue transport rule `pt-2.5`. */
export const SIMPLE_RULE_PT = 10
/** Editorial hero `border-2`. */
export const EDITORIAL_BORDER = 2
/** Editorial phrase `text-[1.125rem]` — not snapped onto title3 (20). */
export const EDITORIAL_TITLE = 18
/** Tailwind `leading-tight` on that 1.125rem face. */
export const EDITORIAL_TITLE_LINE = 22.5
/** HTML editorial/simple hero title `truncate`. */
export const EDITORIAL_TITLE_LINES = 1
/** Editorial transport block `mt-3.5 pt-3`. */
export const EDITORIAL_RULE_MT = 14
export const EDITORIAL_RULE_PT = 12
/** Simple-queue transport rule `mt-3` — space['3']. Not editorial `mt-3.5`. */
export const SIMPLE_RULE_MT = 12
/** HTML speed sits in the transport row — no extra margin above RatePills. */
export const EDITORIAL_RATE_GAP = 0
/** Focused dismiss / Track options `w-9 h-9`. */
export const DISMISS = 36
export const DISMISS_GLYPH = '⌄'
/** HTML dismiss `text-2xl` on keyboard_arrow_down. Same ⌄ glyph. */
export const DISMISS_FACE = 24
/** HTML editorial Options `w-7 h-7` / simple `w-6 h-6`. */
export const OPTIONS_EDITORIAL = 28
export const OPTIONS_SIMPLE = 24
/** HTML editorial/focused Options `rounded-full`; simple `rounded`. */
export const OPTIONS_PILL = 999
export const OPTIONS_SIMPLE_RADIUS = 4
/** HTML focused more_vert `text-xl`. One ⋮ — no Material font. */
export const OPTIONS_GLYPH = '⋮'
export const OPTIONS_FACE = 20
/** HTML editorial/simple more_horiz `text-base`. */
export const OPTIONS_GLYPH_HORIZ = '⋯'
export const OPTIONS_FACE_HORIZ = 16
/** Editorial earlier-row heard well `w-8 h-8`. */
export const EARLIER_MARK = 32
/** Now-playing HTML `max-w/max-h-[280px]` square stage. */
export const STAGE = 280
/** HTML editorial now-playing pulse `w-2 h-2`. */
export const PULSE_DOT = 8
/** HTML simple-queue now-playing pulse `w-1.5 h-1.5`. The well is the dot, not PulseRing's inset. */
export const PULSE_DOT_SIMPLE = 6
/** HTML editorial now-playing kicker pulse-to-label `gap-1.5` — space['1.5']. */
export const PULSE_GAP = 6
/** HTML simple-queue now-playing kicker pulse-to-label `gap-1` — space['1']. */
export const PULSE_GAP_SIMPLE = 4
/** HTML section kickers `text-[10px]`. */
export const SECTION_KICKER = 10
/** HTML section heading row `px-0.5` — space['0.5']. */
export const SECTION_KICKER_PAD_X = 2
/** HTML Hide `text-[10px]`. labelSm is 11 / uppercase — stand both down. */
export const EARLIER_TOGGLE_FACE = 10
/** HTML Hide `font-semibold`. */
export const EARLIER_TOGGLE_WEIGHT = '600'
/** HTML font-label-sm tracking 0.05em on that 10 face. */
export const EARLIER_TOGGLE_TRACK = 0.5
/** HTML editorial meaning `text-xs`. */
export const EDITORIAL_MEANING = 12
export const EDITORIAL_MEANING_LINE = 16
/** HTML meaning `font-medium`. caption is 400; do not italicize the quote. */
export const EDITORIAL_MEANING_WEIGHT = '500'
/** HTML meaning `mt-0.5` — space['0.5']. Copy has no flex gap. */
export const EDITORIAL_MEANING_MT = 2
/** HTML editorial resp `text-[10px]`. Catalog resp only; invented IPA stays omitted. */
export const EDITORIAL_RESP = 10
/** HTML resp row `mt-1` — space['1']. Not the meaning `mt-0.5`. */
export const EDITORIAL_RESP_MT = 4
/** HTML editorial copy column `pr-0.5` — space['0.5']. */
export const EDITORIAL_COPY_PE = 2
/** HTML simple-queue copy column `pr-1` — space['1']. */
export const SIMPLE_COPY_PE = 4
/** HTML editorial transport row `gap-4` — space['4']. */
export const EDITORIAL_TRANSPORT_GAP = 16
/** HTML editorial transport `mt-2` after the rule. Scrubber/times stay omitted. */
export const EDITORIAL_TRANSPORT_MT = 8
/** HTML simple-queue transport sits in the time row — no extra margin. */
export const SIMPLE_TRANSPORT_MT = 0
/** HTML simple-queue prev/play/next cluster `gap-3` — space['3']. Not editorial `gap-4`. */
export const SIMPLE_TRANSPORT_GAP = 12
/** Simple-queue earlier mark `rounded-lg` (0.5rem in that HTML map). */
export const EARLIER_MARK_RADIUS = 8
/** HTML editorial earlier mark `rounded-xl` (0.75rem). */
export const EARLIER_MARK_RADIUS_EDITORIAL = 12
/** HTML up-next phrase `text-[13.5px]`. */
export const QUEUE_PHRASE = 13.5
/** HTML Up Next phrase `truncate`. */
export const QUEUE_PHRASE_LINES = 1
/** HTML up-next index `font-label-sm text-xs font-bold`. Not `label` 11 / 0.05em. */
export const QUEUE_TRACK_FACE = 12
export const QUEUE_TRACK_WEIGHT = '700'
export const QUEUE_TRACK_LETTER = 0
/** Simple-queue up-next chip `px-1.5 py-0.2` / `text-[9px]`. */
export const QUEUE_CHIP_PX = 6
export const QUEUE_CHIP_PY = 0.8
export const QUEUE_CHIP_FACE = 9
export const QUEUE_CHIP_WEIGHT = '700'
/** HTML chips are `text-[9px] font-bold` — not labelSm uppercase / 0.05em. */
export const QUEUE_CHIP_LETTER = 0
/** Simple-queue chip `rounded` (0.25rem). */
export const QUEUE_CHIP_RADIUS = 4
/** Editorial up-next chip `px-2 py-0.5` / `rounded-full`. */
export const QUEUE_CHIP_PX_EDITORIAL = 8
export const QUEUE_CHIP_PY_EDITORIAL = 2
export const QUEUE_CHIP_RADIUS_EDITORIAL = 999
/** HTML simple-queue options+handle cluster `gap-1` — space['1']. Editorial has no handle. */
export const QUEUE_TRAIL_GAP = 4
/** Simple-queue Up Next drag handle `w-6 h-6`. */
export const QUEUE_REORDER = 24
/** HTML drag_handle `text-lg` on the real simple-queue handle. Not "Drag to reorder". */
export const QUEUE_REORDER_GLYPH = '≡'
export const QUEUE_REORDER_FACE = 18
/** HTML editorial/simple Up Next and Earlier meaning `text-[11px]`. Not caption 14. */
export const QUEUE_MEANING = 11
/** HTML Up Next meaning row `mt-0.5` — space['0.5']. Invented `· 1:12` stays omitted. */
export const QUEUE_MEANING_MT = 2
/** HTML editorial earlier-row phrase `text-[13px]`. */
export const EARLIER_PHRASE = 13
/** HTML editorial earlier phrase `leading-snug` on that 13. */
export const EARLIER_PHRASE_LINE = 17.875
/** HTML simple earlier-row phrase `text-sm`. Not snapped onto 13. */
export const EARLIER_PHRASE_SIMPLE = 14
/** HTML simple earlier phrase `text-sm` / 1.25rem. */
export const EARLIER_PHRASE_LINE_SIMPLE = 20
/** HTML focused now-playing `px-5`. List landing stays `px-4`. */
export const FOCUSED_GUTTER = 20
/** HTML main is `flex-col` with no gap — header and cover are adjacent. */
export const FOCUSED_GAP = 0
/** HTML editorial/simple scroll `space-y-4` — space['4']. */
export const LANDING_GAP = 16
/** HTML editorial scroll `py-3.5` — space['3.5']. No sticky dock, so bottom matches top. */
export const LANDING_PAD_TOP_EDITORIAL = 14
/** HTML simple-queue scroll `py-3` — space['3']. Bottom is SIMPLE_FOOTER_RESERVE (`pb-20`). */
export const LANDING_PAD_TOP_SIMPLE = 12
/** HTML cover block `py-0.5` — space['0.5']. */
export const STAGE_WRAP_Y = 2
/** HTML focused header `pt-1` — space['1']. */
export const HEADER_PAD_TOP = 4
/** HTML focused header `pb-1` — space['1']. */
export const HEADER_PAD_BOTTOM = 4
/** HTML header center column `px-2` — space['2']. */
export const KICKER_PAD_X = 8
/** HTML queue header title `text-base`. */
export const QUEUE_HEADER_TITLE = 16
/** HTML queue header title `leading-tight`. */
export const QUEUE_HEADER_TITLE_LINE = 20
/** HTML queue header title `tracking-tight` (−0.025em on 16). title3 has no tracking. */
export const QUEUE_HEADER_TITLE_TRACK = -0.4
/** HTML queue header count `text-[11px]`. */
export const QUEUE_HEADER_COUNT = 11
/** HTML header subtitle `mt-0.5` — space['0.5']. */
export const QUEUE_HEADER_COUNT_MT = 2
/** HTML header count `max-w-[210px]`. */
export const QUEUE_HEADER_COUNT_MAX = 210
/** HTML editorial queue header `pb-2.5` — space['2.5']. */
export const QUEUE_HEADER_PAD_BOTTOM_EDITORIAL = 10
/** HTML simple queue header `pb-2` — space['2']. */
export const QUEUE_HEADER_PAD_BOTTOM_SIMPLE = 8
/** HTML editorial/simple header `px-4`. Not Navigation `CHROME_GUTTER` 20. */
export const LANDING_HEADER_GUTTER = 16
/** HTML dismiss `-ml-2` / options `-mr-2` — −space['2']. */
export const HEADER_HIT_NUDGE = -8
/** HTML cover and title are adjacent — no extra Stack gap. */
export const STAGE_TITLE_GAP = 0
/** HTML title has no extra gap before the honest counter. */
export const TITLE_COUNTER_GAP = 0
/** HTML focused time-row `font-semibold`. Honest `1 / 10`, not 0:14. */
export const COUNTER_WEIGHT = '600'
/** HTML voice row `text-xs` has no tracking. `captionSm` is 0.04em — stand it down. */
export const THEME_TRACK = 0
/** Honest counter and audio note are adjacent — no extra Stack gap. */
export const COUNTER_NOTE_GAP = 0
/** Honest audio note and transport are adjacent — no extra Stack gap. */
export const NOTE_TRANSPORT_GAP = 0
/** HTML title row `pt-1` — space['1']. */
export const TITLE_PAD_TOP = 4
/** HTML title row `pb-1` — space['1']. */
export const TITLE_PAD_BOTTOM = 4
/** HTML title column `pr-2` — space['2']. */
export const TITLE_PAD_END = 8
/** HTML title row has no flex gap — only `pr-2` between copy and actions. */
export const TITLE_ROW_GAP = 0
/** HTML drill peek `pt-1` — space['1']. */
export const DRILL_PAD_TOP = 4
/** HTML focused meaning `text-xs`. */
export const STAGE_MEANING = 12
export const STAGE_MEANING_LINE = 16
/** HTML transport row `px-3` / `pt-0.5 pb-0.5`. */
export const TRANSPORT_PAD_X = 12
export const TRANSPORT_PAD_Y = 2
/** HTML transport is an adjacent sibling — no extra top margin. */
export const TRANSPORT_MARGIN_TOP = 0
/** HTML stage pills `text-[11px]`. */
export const STAGE_PILL_FACE = 11
/** HTML idle stage pill is `font-semibold`. */
export const STAGE_PILL_WEIGHT = '600'
/** HTML selected stage pill is `font-bold`. */
export const STAGE_PILL_WEIGHT_ON = '700'
/** HTML pill chrome — emoji marks, not copy.* labels. */
export const STAGE_PILL_MNEMONIC = '💡'
export const STAGE_PILL_GRAMMAR = '📖'
export const STAGE_PILL_PHONETICS = '🗣️'
/** HTML expand_more / expand_less `text-[13px]`. */
export const STAGE_PILL_ARROW = 13
export const STAGE_PILL_OPEN = '⌃'
export const STAGE_PILL_CLOSED = '⌄'
/** HTML pill `gap-1` between mark and arrow. */
export const STAGE_PILL_MARK_GAP = 4
/** HTML selected pill `ring-2`. Pigment lives on `shadow.pillRing`. */
export const STAGE_PILL_RING = 2

export function stagePillShadows(selected: boolean): readonly ('emblemRaised' | 'playRaised' | 'pillRing')[] {
  return selected ? ['playRaised', 'pillRing'] : ['emblemRaised']
}

/** HTML selected rate pill `ring-2 ring-primary-fixed` (full opacity). */
export const RATE_PILL_RING = 2

export function ratePillShadows(selected: boolean): readonly ('emblemSoft' | 'rateRing')[] {
  return selected ? ['emblemSoft', 'rateRing'] : []
}
/** HTML flyout `rounded-2xl`. */
export const STAGE_PANEL_RADIUS = 16
/** HTML favorite `w-9 h-9`. */
export const LOVE_HIT = 36
/** HTML favorite `text-xl` on the real ♥. */
export const LOVE_FACE = 20
/** Now-playing HTML stage `border border-outline-variant/30`. */
export const STAGE_BORDER = 1
export const TRACK_WIDTH = 24
/** Now-playing HTML primary play `w-[58px] h-[58px]`. */
export const PLAY_SIZE = 58
/** Now-playing HTML prev/next/loop `w-10 h-10`. */
export const TRANSPORT = 40
export const TRANSPORT_PLAY = 28
/** HTML focused skip_previous / skip_next `text-[30px]` on real ◄◄ / ►►. */
export const TRANSPORT_GLYPH = 30
/** HTML focused repeat `text-[22px]` on the real loop hit. Count stays `{n}×`. */
export const LOOP_GLYPH = '↻'
export const LOOP_FACE = 22
/** HTML editorial repeat `text-xs` beside the real `{count}×`. Simple has no loop icon. */
export const EDITORIAL_LOOP_FACE = 12
/** HTML editorial loop `gap-1` — space['1']. */
export const EDITORIAL_LOOP_GAP = 4
/** HTML focused loop badge `text-[8.5px]` on real `{count}×`. */
export const LOOP_BADGE_FACE = 8.5
/** Tailwind `leading-tight` on that 8.5 face. */
export const LOOP_BADGE_LINE = 10.625
/** HTML badge has no tracking. labelSm is 0.05em — stand it down. */
export const LOOP_BADGE_LETTER = 0
/** HTML focused loop badge `px-1`. */
export const LOOP_BADGE_PX = 4
/** HTML focused loop badge `top-1`. */
export const LOOP_BADGE_TOP = 4
/** HTML focused loop badge `right-0.5`. */
export const LOOP_BADGE_END = 2
/** Fill the 280 stage — HTML photo is object-cover; crop past the plate. */
export const STAGE_GLYPH = 616
/** Now-playing HTML phrase `text-[1.45rem]` — not snapped onto title2 (26). */
export const STAGE_TITLE = 23.2
/** Tailwind `leading-tight` on that 1.45rem face. */
export const STAGE_TITLE_LINE = 29
/** Tailwind `tracking-tight` (−0.025em) on that face. */
export const STAGE_TITLE_TRACK = -0.58
export const HERO_RADIUS = 24
/** HTML queue row `p-2.5` / up-next `gap-2.5`. */
export const ROW_PAD = 10
/** HTML editorial Earlier / Up Next `px-3` over `p-2.5`. Simple stays `p-2.5`. */
export const ROW_PAD_X_EDITORIAL = 12
/** HTML simple Up Next list `space-y-1.5` — space['1.5']. */
export const QUEUE_STACK_GAP = 6
/** HTML editorial Up Next list `space-y-2` — space['2']. */
export const QUEUE_STACK_GAP_EDITORIAL = 8
/** HTML simple queue row `rounded-xl` (0.75rem). */
export const QUEUE_ROW_RADIUS = 12
/** HTML editorial Earlier / Up Next `rounded-2xl` (1rem). */
export const QUEUE_ROW_RADIUS_EDITORIAL = 16
/** HTML earlier row `gap-3`. */
export const EARLIER_ROW_GAP = 12
/** HTML simple earlier row `opacity-75`. Editorial is bg/80 only — no row fade. */
export const EARLIER_OPACITY = 0.75
export const EARLIER_OPACITY_EDITORIAL = 1
/** HTML unselected rate `px-2.5` — space['2.5']. */
export const CADENCE_PAD_X = 10
/** HTML selected rate `px-3` — space['3']. */
export const CADENCE_PAD_X_ON = 12
/** Now-playing HTML rate pills `py-1`. */
export const CADENCE_PAD_Y = 4

export function cadencePadX(selected: boolean): number {
  return selected ? CADENCE_PAD_X_ON : CADENCE_PAD_X
}

/** HTML rate row `py-0.5` — space['0.5']. Not the Stack `space['2']` gap. */
export const CADENCE_ROW_Y = 2

/** HTML unselected rate `font-label-sm` — typography.scale.labelSm.weight. */
export const CADENCE_FACE_WEIGHT = 500
/** HTML selected rate `font-bold` — sans weight 700. */
export const CADENCE_FACE_WEIGHT_ON = 700

export function cadenceFaceWeight(selected: boolean): 500 | 700 {
  return selected ? CADENCE_FACE_WEIGHT_ON : CADENCE_FACE_WEIGHT
}
export const CAPSULE_PAD = 4
/** HTML rating capsule `pt-1` — space['1']. */
export const CAPSULE_PAD_TOP = 4
/** HTML rating capsule `pb-0.5` — space['0.5']. */
export const CAPSULE_PAD_BOTTOM = 2
export const REPLAY_GLYPH = '↺'
/** HTML editorial Earlier replay `w-8 h-8`. */
export const EARLIER_REPLAY_EDITORIAL = 32
/** Simple-queue Earlier replay `w-7 h-7`. */
export const EARLIER_REPLAY = 28
/** HTML simple Earlier replay icon `text-lg` inside that 28. */
export const EARLIER_REPLAY_GLYPH = 18
/** Earlier-row heard well — not the HTML "Mastered" label. */
export const HEARD_GLYPH = '✓'
/** HTML earlier check_circle `text-base` on the real ✓. */
export const HEARD_FACE = 16
export const LOVE_GLYPH = '♥'
/** HTML focused pause/play `text-3xl` — token triangle / two bars in a 30 face. */
export const FOCUSED_PLAY_FACE = 30
export const PLAY_TRI_W = FOCUSED_PLAY_FACE
export const PLAY_TRI_H = FOCUSED_PLAY_FACE / 2
export const PAUSE_BAR_W = 4
export const PAUSE_BAR_H = FOCUSED_PLAY_FACE
export const PAUSE_GAP = 6
/** HTML editorial pause/play `text-xl` — token triangle in a 20 box, only when canPlay. */
export const EDITORIAL_PLAY_FACE = 20
export const EDITORIAL_PLAY_TRI_W = EDITORIAL_PLAY_FACE
export const EDITORIAL_PLAY_TRI_H = EDITORIAL_PLAY_FACE / 2
export const EDITORIAL_PAUSE_W = 3
export const EDITORIAL_PAUSE_H = EDITORIAL_PLAY_FACE
/** HTML simple pause/play `text-base` — token triangle in a 16 box, only when canPlay. */
export const SIMPLE_PLAY_FACE = 16
export const COMPACT_PLAY_TRI_W = SIMPLE_PLAY_FACE
export const COMPACT_PLAY_TRI_H = SIMPLE_PLAY_FACE / 2
/** HTML simple pause `text-base` — two bars in a 16 face, only while playing. */
export const COMPACT_PAUSE_W = 3
export const COMPACT_PAUSE_H = SIMPLE_PLAY_FACE
/** Now-playing HTML stage pills `px-2.5 py-1`, overlay `top-2.5`. */
export const STAGE_PILL_X = 10
export const STAGE_PILL_Y = 4
export const STAGE_PILL_TOP = 10
export const STAGE_PANEL_PAD = 10
/** Pill row + gap so the flyout stays inside the 280 stage. */
export const STAGE_PANEL_MAX = STAGE - STAGE_PILL_TOP - 40
/** HTML editorial Done chip `px-4 py-1.5` / `text-xs` / `font-semibold`. */
export const DONE_PX = 16
export const DONE_PY = 6
export const DONE_FACE = 12
export const DONE_WEIGHT = 600
/** HTML simple Done chip `px-3 py-1` / `font-bold`. */
export const DONE_PX_SIMPLE = 12
export const DONE_PY_SIMPLE = 4
export const DONE_WEIGHT_SIMPLE = 700

export function queueTrack(index: number): string {
  return String(index).padStart(2, '0')
}

/** Editorial HTML `shadow-sm`; simple-queue HTML `shadow-md`. */
export type QueueDressing = 'editorial' | 'simple'

export function queueHeroElevation(
  dressing: QueueDressing,
): 'emblemSoft' | 'emblemRaised' {
  return dressing === 'simple' ? 'emblemRaised' : 'emblemSoft'
}

export function queueHeroRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_RADIUS : EDITORIAL_RADIUS
}

export function queueHeroPad(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_PAD : EDITORIAL_PAD
}

export function queueHeroCopyPadEnd(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_COPY_PE : EDITORIAL_COPY_PE
}

export function queueHeroTransportGap(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_TRANSPORT_GAP : EDITORIAL_TRANSPORT_GAP
}

export function queueHeroTransportMt(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_TRANSPORT_MT : EDITORIAL_TRANSPORT_MT
}

export function queueHeroRuleMt(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_RULE_MT : EDITORIAL_RULE_MT
}

export function queueHeroRulePt(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_RULE_PT : EDITORIAL_RULE_PT
}

export function landingPadTop(dressing: QueueDressing): number {
  return dressing === 'simple' ? LANDING_PAD_TOP_SIMPLE : LANDING_PAD_TOP_EDITORIAL
}

export function landingPadBottom(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_FOOTER_RESERVE : LANDING_PAD_TOP_EDITORIAL
}

export function queueHeaderPadBottom(dressing: QueueDressing): number {
  return dressing === 'simple'
    ? QUEUE_HEADER_PAD_BOTTOM_SIMPLE
    : QUEUE_HEADER_PAD_BOTTOM_EDITORIAL
}

export function queueRowRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? QUEUE_ROW_RADIUS : QUEUE_ROW_RADIUS_EDITORIAL
}

export function queueRowPadX(dressing: QueueDressing): number {
  return dressing === 'simple' ? ROW_PAD : ROW_PAD_X_EDITORIAL
}

export function queueStackGap(dressing: QueueDressing): number {
  return dressing === 'simple' ? QUEUE_STACK_GAP : QUEUE_STACK_GAP_EDITORIAL
}

export function queueChipPadX(dressing: QueueDressing): number {
  return dressing === 'simple' ? QUEUE_CHIP_PX : QUEUE_CHIP_PX_EDITORIAL
}

export function queueChipPadY(dressing: QueueDressing): number {
  return dressing === 'simple' ? QUEUE_CHIP_PY : QUEUE_CHIP_PY_EDITORIAL
}

export function queueChipRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? QUEUE_CHIP_RADIUS : QUEUE_CHIP_RADIUS_EDITORIAL
}

export function queuePulseDot(dressing: QueueDressing): number {
  return dressing === 'simple' ? PULSE_DOT_SIMPLE : PULSE_DOT
}

export function queuePulseGap(dressing: QueueDressing): number {
  return dressing === 'simple' ? PULSE_GAP_SIMPLE : PULSE_GAP
}

export function donePadX(dressing: QueueDressing): number {
  return dressing === 'simple' ? DONE_PX_SIMPLE : DONE_PX
}

export function donePadY(dressing: QueueDressing): number {
  return dressing === 'simple' ? DONE_PY_SIMPLE : DONE_PY
}

export function doneWeight(dressing: QueueDressing): 600 | 700 {
  return dressing === 'simple' ? DONE_WEIGHT_SIMPLE : DONE_WEIGHT
}

export function earlierMarkRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? EARLIER_MARK_RADIUS : EARLIER_MARK_RADIUS_EDITORIAL
}

export function earlierReplayHit(dressing: QueueDressing): number {
  return dressing === 'simple' ? EARLIER_REPLAY : EARLIER_REPLAY_EDITORIAL
}

export function earlierPhraseFace(dressing: QueueDressing): number {
  return dressing === 'simple' ? EARLIER_PHRASE_SIMPLE : EARLIER_PHRASE
}

export function earlierPhraseLine(dressing: QueueDressing): number {
  return dressing === 'simple' ? EARLIER_PHRASE_LINE_SIMPLE : EARLIER_PHRASE_LINE
}

export function earlierOpacity(dressing: QueueDressing): number {
  return dressing === 'simple' ? EARLIER_OPACITY : EARLIER_OPACITY_EDITORIAL
}

export function queueCoverRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? SIMPLE_COVER_RADIUS : COVER_RADIUS
}

export function queueOptionsSize(dressing: QueueDressing): number {
  return dressing === 'simple' ? OPTIONS_SIMPLE : OPTIONS_EDITORIAL
}

export function queueOptionsRadius(dressing: QueueDressing): number {
  return dressing === 'simple' ? OPTIONS_SIMPLE_RADIUS : OPTIONS_PILL
}

/** Landing omits the param and stays editorial. `?queue=simple` is the other dressing. */
export function queueDressingFromParam(
  queue: string | readonly string[] | undefined,
): QueueDressing {
  const value = Array.isArray(queue) ? queue[0] : queue
  return value === 'simple' ? 'simple' : 'editorial'
}
