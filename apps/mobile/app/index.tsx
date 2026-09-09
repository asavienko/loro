import { rustCoreFacade } from '../src/store/coreFacade'
import { useLocale } from '../src/lib/i18n'
/**
 * Today — the ritual home, drawn on the v1.1 navigation shell.
 *
 * Two authored artifacts meet on this screen, and precedence between them is scoped
 * ([design-system.md](../../../docs/design/design-system.md#source-hierarchy)):
 *
 *   • `Loro.dc.html:1316–1391` (`DayLogic` `3295–3341`) owns WHAT is here — a closed, finite set
 *     you can see in full and finish, the three waves, and the rolling window's banked tail.
 *   • `Navigation.dc.html:82–165` owns HOW it is drawn and how it is left: the 28-px spine above
 *     the header, the root header band, the text rail out of the thumb arc, the day as hairline
 *     rows rather than cards, and exactly one filled control on the screen.
 *
 * So this is Loro's content under Navigation's laws. Four blocks, in reading order, each named
 * below: the chrome (spine · header · rail), the day, today's set, and the banked tail. The
 * default export derives the numbers and lays those out; nothing in it draws.
 *
 * ── What the authored home draws and this screen does not ──
 * Deliberate omissions, because the data behind each one does not exist yet and an invented
 * number is the one thing this app may not show (non-negotiable 2): the ambient loop row and its
 * travelling transport (no audio module — plan 62), the "kept from chat" row (no chat — plan 83),
 * the fading tail (nothing tracks a phrase leaving rotation), and the switcher's Ongoing group
 * (nothing in the store is ongoing yet — plan 81, with 59/64). The spine and switcher now live
 * in the shared root layout, using the same built-destination declaration as this rail.
 */

import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBar } from '../src/ui/BottomBarContext'
import {
  DEFAULT_REP_TARGET,
  LOCK_IN_DAYS_TO_GRADUATE,
  repsToday as repsTodayOf,
  streak as streakOf,
} from '@loro/core'
import {
  Button,
  Pill,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import { ActionBar } from '../src/ui/components'
import { DESTINATIONS } from '../src/lib/navigation'
import {
  HIT_SLOP,
  MIN_TAP,
  accent,
  actionBar,
  border,
  ink,
  line,
  scale,
  space,
  surface,
} from '../src/ui/theme'
import { PRODUCTION_WAVE_TIMES, toView, useApp, type PhraseView } from '../src/store'
import { copy } from '../src/lib/copy'
import { deviceClock, localDateLabel, localTimeLabel } from '../src/lib/clock'
import { waveSchedule, type ScheduledWave, type WavePosition } from '../src/lib/waves'
/** Full automaticity: six reps in one day. The badge, the bar's colour and the count agree. */
const isLockedIn = (p: Pick<PhraseView, 'automaticity'>): boolean => p.automaticity >= 100
/**
 * The three waves, in order. STRUCTURE lives here; their times are engine settings
 * (`PRODUCTION_WAVE_TIMES`) and their words are copy (`copy.today.waves`).
 */
const WAVES = ['morning', 'midday', 'evening'] as const
type WaveKey = (typeof WAVES)[number]
/**
 * The rail: the built destinations, side by side on a hairline, out of the thumb arc
 * (`Navigation.dc.html:130–137`). `counted` marks the one that carries a number — the authored
 * rail shows a due count beside Review, which is not built; the stream's count is the phrases in
 * it, which is the number Today's third stat tile used to carry.
 */
const RAIL = DESTINATIONS.filter((destination) => destination.rail)

export default function Today() {
  useLocale()
  const onboarded = useApp((s) => s.onboarded)
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const refrainWaves = useApp((s) => s.refrainWaves)
  const ensure = useApp((s) => s.ensureRefrainSet)
  const practiceDays = useApp((s) => s.practiceDays)
  // Derived, never stored — the same function the widget will call (ADR-0002).
  const streak = streakOf(practiceDays, deviceClock.streakDay())
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()

  useEffect(() => {
    if (onboarded) ensure()
  }, [onboarded, ensure, phrases.length])
  if (!onboarded) return <Redirect href="/onboarding" />
  /**
   * Today's set, with the two day-scoped signals DERIVED rather than read.
   *
   * `repsToday` and `automaticity` are stored undated next to `repsTodayDay`, so the row
   * still carries yesterday's values until the next write. Reading them raw made this
   * screen claim "1 of 5 locked in", "6 reps today" and a `Locked` badge at 100% on a
   * morning the learner had not practised — a number that is not real (non-negotiable 2).
   *
   * `repsToday(p, day)` is the day-scoped reader that exists for exactly this
   * (`packages/core/src/domain/phrase.ts:230-239`) and `automaticity()` is a pure function
   * of it. The Refrain already derives both this way (`app/practice/refrain.tsx:131-132`);
   * this screen was the one place that did not.
   */
  const day = deviceClock.localDay()
  const set = refrainSet
    .map((id) => phrases.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => {
      const reps = repsTodayOf(p, day)
      return {
        ...toView(p),
        repsToday: reps,
        automaticity: rustCoreFacade.automaticity(reps, DEFAULT_REP_TARGET),
      }
    })
  const lockedIn = set.filter(isLockedIn).length
  const totalReps = set.reduce((n, p) => n + p.repsToday, 0)
  const graduated = phrases.filter((p) => p.graduatedAt !== null).length
  /**
   * Where the day is. The clock decides, not a position in an array — the old readiness rule
   * ("the morning wave is always ready, the other two open once something is locked in") was the
   * screen guessing at what the scheduler knows. `??` is unreachable while `PRODUCTION_WAVE_TIMES`
   * has entries, and keeps the CTA labelled if it ever does not.
   */
  const completedWaves = refrainWaves.filter((wave): wave is WaveKey =>
    WAVES.includes(wave as WaveKey),
  )
  const waves = waveSchedule(WAVES, PRODUCTION_WAVE_TIMES, localTimeLabel(), completedWaves)
  const nextWaveKey = waves.find((wave) => wave.position === 'next')?.key ?? WAVES[0]
  const startWave = (wave = nextWaveKey): void => {
    router.push({ pathname: '/practice/refrain', params: { wave } })
  }
  return (
    <Screen>
      {/*
        The chrome sits ABOVE the scroll view, as the authored home has it: three `flex:none`
        bands that stay put while the day scrolls under them.
      */}
      <View>
        <TodayHeader streak={streak} />
        <NavRail inStream={phrases.length} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            // Keep the final row reachable when enlarged text makes the action bar taller.
            paddingBottom: Math.max(
              insets.bottom + actionBar.clearance.today,
              bottomBarHeight + space['4'],
            ),
          },
        ]}
      >
        <DayList
          waves={waves}
          setSize={set.length}
          totalReps={totalReps}
          // With nothing in rotation the wave is not a way in, and the row must not say it is
          // while the CTA below says the opposite.
          onStartWave={set.length === 0 ? undefined : startWave}
        />
        <TodaySet set={set} lockedIn={lockedIn} />
        <BankedTail graduated={graduated} />
      </ScrollView>

      <ActionBar>
        <Button
          size="cta"
          label={set.length === 0 ? copy.today.cta.empty : copy.today.cta.startWave[nextWaveKey]}
          disabled={set.length === 0}
          accessibilityHint={copy.a11y.today.startHint(set.length, DEFAULT_REP_TARGET)}
          onPress={() => {
            startWave()
          }}
        />
      </ActionBar>
    </Screen>
  )
}
/**
 * The root header: the date, the title, and the streak (`Navigation.dc.html:112–119`).
 *
 * Root has no back — the authored root band carries the place and one value, nothing else. The
 * date is the real day rather than the blueprint's "Tuesday · the daily refrain" tagline, and the
 * streak keeps the tinted capsule the authored root exemplar gives it (`Navigation.dc.html:55`)
 * while dropping the flame: v1.1 WORDS the streak ("14 days") instead of pairing a bare number
 * with an emoji, which also gives it a reading that does not depend on the glyph rendering.
 */
function TodayHeader({ streak }: { streak: number }) {
  useLocale()
  return (
    <Row justify="space-between" align="flex-end" wrap style={s.header}>
      <View style={s.grow}>
        <Text variant="bodySm" color={ink.muted} style={s.dateLine}>
          {localDateLabel()}
        </Text>
        <Text variant="title2" color={ink.ink}>
          {copy.today.title}
        </Text>
      </View>
      <Pill
        size="capsule"
        tone="accent"
        // A learner on day zero sees an absence, not a zero.
        label={streak === 0 ? copy.common.noValue : copy.today.streakDays(streak)}
      />
    </Row>
  )
}
/** The rail — text only, on a hairline, carrying the one count it has (`--rail-count`). */
function NavRail({ inStream }: { inStream: number }) {
  useLocale()
  return (
    <Row gap={NAV.railGap} wrap style={s.rail}>
      {RAIL.map((dest) => (
        <Pressable
          key={dest.href}
          feedback="row"
          accessibilityLabel={
            dest.counted ? copy.a11y.today.railCount(dest.label, inStream) : dest.label
          }
          onPress={() => {
            router.push(dest.href)
          }}
          style={s.railItem}
        >
          <Text variant="bodySm" color={ink.ink2} style={s.railText}>
            {dest.label}
          </Text>
          {dest.counted && (
            <Text variant="bodySm" color={accent.accentInk} style={s.railText}>
              {inStream}
            </Text>
          )}
        </Pressable>
      ))}
    </Row>
  )
}
/**
 * The day, in order — waves first, then what has happened so far
 * (`Navigation.dc.html:121–156`).
 *
 * Only the next wave is full weight and only it carries a second line; the ones the clock has
 * gone past recede. Completed waves carry the authored "done" state from the durable course day.
 */
function DayList({
  waves,
  setSize,
  totalReps,
  onStartWave,
}: {
  waves: readonly ScheduledWave<WaveKey>[]
  setSize: number
  totalReps: number
  onStartWave: ((wave: WaveKey) => void) | undefined
}) {
  useLocale()
  return (
    <View>
      <SectionLabel>{copy.today.day.heading}</SectionLabel>
      {waves.map((wave) => {
        const { title, manner } = copy.today.waves[wave.key]
        const detail = copy.today.day.nextWave(manner, setSize)
        const next = wave.position === 'next' && !wave.completed
        return (
          <DayRow
            key={wave.key}
            time={wave.time}
            title={title}
            meta={next ? detail : undefined}
            position={wave.position}
            completed={wave.completed ?? false}
            accessibilityLabel={next ? copy.a11y.today.nextWaveRow(title, detail) : undefined}
            onPress={
              next && onStartWave
                ? () => {
                    onStartWave(wave.key)
                  }
                : undefined
            }
          />
        )
      })}
      <DayRow
        time={copy.today.day.now}
        title={copy.today.day.reps(totalReps)}
        position="passed"
        last
      />
    </View>
  )
}
/**
 * One row of the day: a time column, what it is, and — when it is next — the way in.
 *
 * A hairline row, not a card: "no card sits where a hairline will do". The authored row also has a
 * status slot ("done"), rendered when durable course state records the completed wave.
 */
function DayRow({
  time,
  title,
  meta,
  position,
  completed = false,
  last = false,
  accessibilityLabel,
  onPress,
}: {
  time: string
  title: string
  meta?: string | undefined
  position: WavePosition
  completed?: boolean | undefined
  last?: boolean | undefined
  /**
   * Set when the row would otherwise be read wrong: a number alone in the time column, or a
   * pressable row whose second line is part of what it does.
   */
  accessibilityLabel?: string | undefined
  onPress?: (() => void) | undefined
}) {
  useLocale()
  const next = position === 'next' && !completed
  const row = (
    <Row align={meta === undefined ? 'center' : 'baseline'} gap={NAV.rowGap} style={s.dayRow}>
      <Text variant="bodySm" color={next ? accent.accentInk : ink.muted} style={s.dayTime}>
        {time}
      </Text>
      <View style={s.grow}>
        <Text
          variant={next ? 'body' : 'caption'}
          color={position === 'passed' ? ink.muted : ink.ink}
          style={next ? undefined : s.dayTitle}
        >
          {title}
        </Text>
        {meta !== undefined && (
          <Text variant="captionSm" color={ink.muted} style={s.dayMeta}>
            {meta}
          </Text>
        )}
        {completed && (
          <Text variant="captionSm" color={ink.muted}>
            {copy.today.day.completed}
          </Text>
        )}
      </View>
      {/* The chevron is the affordance, so it appears when the row is one — not merely
            because the row is next. */}
      {onPress !== undefined && (
        <Text variant="captionSm" color={accent.accentInk} style={s.chevron}>
          {copy.common.chevron.right}
        </Text>
      )}
    </Row>
  )
  if (onPress !== undefined) {
    return (
      <Pressable
        feedback="row"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        style={last ? null : s.hairline}
      >
        {row}
      </Pressable>
    )
  }
  return (
    <View
      style={last ? null : s.hairline}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      {row}
    </View>
  )
}
/**
 * Today's set: closed, finite, finishable — as hairline rows rather than a card. Owns its own
 * empty state, which keeps the one working way out of it (the CTA is relabelled and disabled).
 */
function TodaySet({ set, lockedIn }: { set: readonly PhraseView[]; lockedIn: number }) {
  useLocale()
  return (
    <View>
      <Row justify="space-between" align="baseline" wrap style={s.setHeader}>
        <SectionLabel>{copy.today.setHeading(set.length)}</SectionLabel>
        <Text variant="labelSm" color={ink.muted}>
          {copy.today.lockedIn(lockedIn, set.length)}
        </Text>
      </Row>

      {set.length === 0 ? (
        <Stack gap={space['2']}>
          <Text variant="caption" color={ink.muted}>
            {copy.today.empty.body}
          </Text>
          <Button
            label={copy.common.addPhrases}
            variant="secondary"
            onPress={() => {
              router.push('/add')
            }}
          />
        </Stack>
      ) : (
        set.map((p, i) => <SetRow key={p.id} phrase={p} last={i === set.length - 1} />)
      )}
    </View>
  )
}
/**
 * One phrase in today's set.
 *
 * Not a `PhraseRow`: no English line, no emoji, no container of its own, and a progress bar
 * where that component has a trailing slot (ui-api.md §4). `day 2/4` is the phrase's place in
 * the four-day lock-in window that graduates it — `lockInDays` counts distinct days locked in,
 * so the day being worked is the next one.
 */
function SetRow({ phrase, last }: { phrase: PhraseView; last: boolean }) {
  useLocale()
  const locked = isLockedIn(phrase)
  const lockInDay = Math.min(phrase.lockInDays + 1, LOCK_IN_DAYS_TO_GRADUATE)
  return (
    <Pressable
      feedback="row"
      accessibilityLabel={copy.a11y.today.phraseRow(
        phrase.targetText,
        phrase.automaticity,
        lockInDay,
        LOCK_IN_DAYS_TO_GRADUATE,
      )}
      accessibilityHint={copy.a11y.common.opensPhraseDetails}
      onPress={() => {
        router.push(`/phrase/${phrase.id}`)
      }}
      style={[s.setRow, last ? null : s.hairline]}
    >
      <Row justify="space-between" style={s.setRowTop}>
        <Text variant="caption" color={ink.ink} numberOfLines={1} lang="target" style={s.grow}>
          {phrase.targetText}
        </Text>
        {locked && <Pill size="xs" tone="accent" label={copy.today.lockedBadge} />}
        {/* Lower case, unlike the badge beside it: the blueprint shouts LOCKED and murmurs
            "day 1/4", and the difference is what keeps the badge the loud one. */}
        <Text variant="labelSm" color={ink.muted} style={s.rowValue}>
          {copy.today.lockInDay(lockInDay, LOCK_IN_DAYS_TO_GRADUATE)}
        </Text>
      </Row>
      {/* Unnamed on purpose: the row's own label already reads
            "…, 0 percent automatic.", so a named bar inside it would announce
            the same number twice. One focusable element per row
            (accessibility.md#every-phrase-row). */}
      <ProgressBar
        value={phrase.automaticity / 100}
        color={locked ? accent.accent : scale.ladder.bent}
        track={surface.sunken}
      />
    </Pressable>
  )
}
/**
 * The tail of the rolling window: what has graduated out of rotation for good
 * (`Navigation.dc.html:152–155`, `Loro.dc.html:1381–1384`).
 *
 * The number is in the time column, where the authored list puts it, so the row is grouped and
 * named — "0" read on its own says nothing.
 */
function BankedTail({ graduated }: { graduated: number }) {
  useLocale()
  return (
    <View style={s.tail}>
      <DayRow
        time={String(graduated)}
        title={copy.today.day.banked}
        position="passed"
        accessibilityLabel={copy.a11y.today.banked(graduated)}
        last
      />
    </View>
  )
}
/**
 * The navigation band's own metrics, transcribed from `design/…/tokens/navigation.css`.
 *
 * These header, rail and day-row values still have one call site. Shared spine geometry moved
 * with it into NavigationMenu. Authored values are preserved rather than rounded.
 */
const NAV = {
  /** `--nav-gutter`. On the space scale at 20, unlike the 18 the older screens use. */
  gutter: space['5'],
  /** `--rail-h` 34 and `--rail-gap-x` 16. */
  railHeight: 34,
  railGap: 16,
  /**
   * The rail is text at its natural width, and "Add" draws 23 px of it — under the tap-target
   * floor even with the slop `Pressable` adds. So the box carries the difference exactly, rather
   * than the `MIN_TAP` an icon button gets, which would put 21 px of dead space after the
   * shortest label and pull the authored 16-px rhythm apart.
   */
  railMinWidth: MIN_TAP - HIT_SLOP * 2,
  /** `--nav-row-pad-y` 13, and the 11-px gap the authored day row uses. */
  rowPadY: 13,
  rowGap: 11,
  /** `--day-time-w` 34. */
  timeWidth: 34,
} as const
/**
 * The band's type sizes.
 *
 * The generated scale has no 11.5-px step and pairs 14 px with weight 700, while the authored
 * navigation text is 11–14 px at 600/700 (`--spine-place-size`, `--nav-action-size`, and the day
 * row's own sizes). Each is applied as a one-property override on the nearest variant so the
 * weight and tracking still come from the scale, and none of them is rounded to a step it is not.
 */
const NAV_TEXT = {
  /** `--nav-action-size`. */
  rail: 11.5,
  /** The root header's date line, 11 (`Navigation.dc.html:113`). */
  date: 11,
  /** The day row: an 11-px time column, a 14-px title, an 11-px second line. */
  time: 11,
  title: 14,
  meta: 11,
  /** The row chevron. */
  chevron: 13,
} as const
const s = StyleSheet.create({
  scroll: { paddingHorizontal: NAV.gutter, paddingTop: space['3.5'], gap: space['4'] },
  /** Take the row's remaining width — the date/title block, a day row's title, a phrase. */
  grow: { flex: 1 },
  // ── the chrome ──
  header: { paddingHorizontal: NAV.gutter, paddingTop: space['1'], paddingBottom: space['2.5'] },
  dateLine: { fontSize: NAV_TEXT.date },
  rail: {
    paddingHorizontal: NAV.gutter,
    paddingBottom: space['2.5'],
    borderBottomWidth: border.hairline,
    borderBottomColor: line.subtle,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space['1'],
    minHeight: NAV.railHeight,
    minWidth: NAV.railMinWidth,
  },
  railText: { fontSize: NAV_TEXT.rail },
  // ── the hairline list every block below the chrome is made of ──
  hairline: { borderBottomWidth: border.hairline, borderBottomColor: line.subtle },
  dayRow: { paddingVertical: NAV.rowPadY },
  /**
   * Preserve the authored 34-px minimum, but let the full time grow with native font scaling.
   * A fixed width and single-line clamp hid the minutes on Android.
   */
  dayTime: {
    minWidth: NAV.timeWidth,
    flexShrink: 0,
    fontSize: NAV_TEXT.time,
    fontVariant: ['tabular-nums'],
  },
  dayTitle: { fontSize: NAV_TEXT.title },
  dayMeta: { fontSize: NAV_TEXT.meta, marginTop: space['0.5'] },
  chevron: { fontSize: NAV_TEXT.chevron },
  /** The banked row hangs off the set above it, so its rule is on top. */
  tail: { borderTopWidth: border.hairline, borderTopColor: line.subtle },
  setHeader: { paddingBottom: space['1'] },
  setRow: { paddingVertical: NAV.rowPadY },
  setRowTop: { marginBottom: 5 },
  rowValue: { textTransform: 'none' },
})
