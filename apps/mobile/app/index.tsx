import { rustCoreFacade } from '../src/store/coreFacade'
import { useLocale } from '../src/lib/i18n'
/**
 * Today — the ritual home, drawn in v1.2 editorial stationery.
 *
 * Two authored artifacts meet on this screen, and precedence between them is scoped
 * ([design-system.md](../../../docs/design/design-system.md#source-hierarchy)):
 *
 *   • `Loro.dc.html:1316–1391` (`DayLogic` `3295–3341`) owns WHAT is here — a closed, finite set
 *     you can see in full and finish, the three waves, and the rolling window's banked tail.
 *   • `Navigation.dc.html:82–165` owns HOW it is left: the 28-px spine above the header, the
 *     root header band, the text rail out of the thumb arc, and exactly one filled control.
 *     `today_daily_waves_phrases` restyles the three waves as a stationery card with a
 *     terracotta time plate on the next wave. The reps-so-far and banked rows stay hairline.
 *
 * So this is Loro's content under Navigation's laws, dressed in v1.2 stationery. Four blocks,
 * in reading order, each named below: the chrome (spine · header · rail), the day, today's
 * set, and the banked tail. The default export derives the numbers and lays those out; nothing
 * in it draws.
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
import { useAccount } from '../src/lib/account/runtime'
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
  Card,
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
import { stationeryElevation } from '../src/ui/elevation'
import { chromeHairlineShadow, parchmentGlassStyle } from '../src/ui/parchmentGlass'
import {
  HIT_SLOP,
  MIN_TAP,
  accent,
  actionBar,
  ink,
  line,
  onDark,
  radius,
  scale,
  space,
  surface,
  type as typeScale,
} from '../src/ui/theme'
import {
  PRODUCTION_WAVES,
  PRODUCTION_WAVE_TIMES,
  toView,
  useApp,
  type PhraseView,
  type ProductionWave,
} from '../src/store'
import { copy } from '../src/lib/copy'
import { deviceClock, localDateLabel, localTimeLabel } from '../src/lib/clock'
import { useLocalMinute } from '../src/lib/useLocalMinute'
import {
  waveEntryWithResume,
  waveSchedule,
  type ScheduledWave,
  type WavePosition,
} from '../src/lib/waves'
/** Full automaticity: six reps in one day. The badge, the bar's colour and the count agree. */
const isLockedIn = (p: Pick<PhraseView, 'automaticity'>): boolean => p.automaticity >= 100
/** Structure is `PRODUCTION_WAVES`; times are settings; words are `copy.today.waves`. */
type WaveKey = ProductionWave
/**
 * The rail: the built destinations, side by side on a hairline, out of the thumb arc
 * (`Navigation.dc.html:130–137`). `counted` marks the one that carries a number — the authored
 * rail shows a due count beside Review, which is not built; the stream's count is the phrases in
 * it, which is the number Today's third stat tile used to carry.
 */
const RAIL = DESTINATIONS.filter((destination) => destination.rail)

export default function Today() {
  useLocale()
  const signedIn = useAccount().session !== null
  const onboarded = useApp((s) => s.onboarded)
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const refrainWaves = useApp((s) => s.refrainWaves)
  const refrainResume = useApp((s) => s.refrainResume)
  const ensure = useApp((s) => s.ensureRefrainSet)
  const practiceDays = useApp((s) => s.practiceDays)
  // Derived, never stored — the same function the widget will call (ADR-0002).
  const streak = streakOf(practiceDays, deviceClock.streakDay())
  const localMinute = useLocalMinute()
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()

  useEffect(() => {
    if (onboarded) ensure()
  }, [onboarded, ensure, phrases.length, localMinute])
  if (!signedIn) return <Redirect href="/account" />
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
    PRODUCTION_WAVES.includes(wave as WaveKey),
  )
  const waves = waveSchedule(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    localTimeLabel(),
    completedWaves,
  )
  const entry = waveEntryWithResume(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    localTimeLabel(),
    completedWaves,
    refrainResume,
  )
  const nextWaveKey = waves.find((wave) => wave.position === 'next')?.key ?? PRODUCTION_WAVES[0]
  const resumeWave = refrainResume.wave ?? nextWaveKey
  const resumeRep =
    refrainResume.session === null
      ? null
      : Math.min(refrainResume.cursor + 1, refrainResume.session.plan.items.length)
  const hasResume = entry.kind === 'resume' && resumeRep !== null && resumeRep > 0
  const canStartWave = set.length > 0 && (entry.kind === 'ready' || entry.kind === 'resume')
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
        <TodayHeader streak={streak} totalReps={totalReps} />
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
        {hasResume && (
          <ResumeRow
            label={copy.nav.ongoing.refrain(resumeRep)}
            onPress={() => {
              router.push({ pathname: '/practice/refrain', params: { wave: resumeWave } })
            }}
          />
        )}
        <DayList
          waves={waves}
          setSize={set.length}
          totalReps={totalReps}
          // With nothing in rotation the wave is not a way in, and the row must not say it is
          // while the CTA below says the opposite.
          onStartWave={canStartWave ? startWave : undefined}
        />
        <TodaySet set={set} lockedIn={lockedIn} />
        <BankedTail graduated={graduated} />
      </ScrollView>

      <ActionBar>
        <Button
          size="cta"
          label={
            set.length === 0
              ? copy.today.cta.empty
              : hasResume
                ? copy.today.cta.resumeRefrain
                : entry.kind === 'resume'
                  ? copy.today.cta.resumeRefrain
                  : entry.kind === 'ready'
                    ? copy.today.cta.startWave[entry.wave.key]
                    : entry.kind === 'locked'
                      ? copy.today.cta.waitForWave(entry.next.time)
                      : copy.today.cta.complete
          }
          disabled={!canStartWave}
          accessibilityHint={
            canStartWave ? copy.a11y.today.startHint(set.length, DEFAULT_REP_TARGET) : undefined
          }
          onPress={() => {
            if (entry.kind === 'resume' || entry.kind === 'ready')
              startWave(entry.kind === 'resume' ? entry.wave : entry.wave.key)
          }}
        />
      </ActionBar>
    </Screen>
  )
}

/** The sole resume affordance on the resolved home (`Navigation.dc.html:520–571`). */
function ResumeRow({ label, onPress }: { label: string; onPress: () => void }) {
  useLocale()
  return (
    <Pressable feedback="row" accessibilityLabel={label} onPress={onPress}>
      <Card padding={space['4']} radius={radius.xl} background={surface.card} border={false}>
        <Row align="center" gap={space['2']}>
          <Text variant="body" color={ink.ink} style={s.grow}>
            {label}
          </Text>
          <Text variant="captionSm" color={accent.accentInk}>
            {copy.common.chevron.right}
          </Text>
        </Row>
      </Card>
    </Pressable>
  )
}
/**
 * The root header: the date, the title, and the streak (`Navigation.dc.html:112–119`).
 *
 * Root has no back — the authored root band carries the place and one value, nothing else. The
 * date is the real day rather than the blueprint's "Tuesday · the daily refrain" tagline, and the
 * streak keeps the tinted capsule the authored root exemplar gives it (`Navigation.dc.html:55`).
 * v1.2 pairs a flame with the real day count; day zero is still an absence, not a zero.
 */
function TodayHeader({ streak, totalReps }: { streak: number; totalReps: number }) {
  useLocale()
  return (
    <View style={[s.header, parchmentGlassStyle(), chromeHairlineShadow()]}>
      <Row justify="space-between" align="center" wrap>
        <Text variant="caption" color={ink.ink2} style={s.dateLine}>
          {localDateLabel()}
        </Text>
        <Pill
          size="capsule"
          tone="accent"
          {...(streak === 0 ? {} : { emoji: copy.common.flame })}
          // A learner on day zero sees an absence, not a zero.
          label={streak === 0 ? copy.common.noValue : copy.today.streakDays(streak)}
        />
      </Row>
      <Row justify="space-between" align="baseline" wrap>
        <Text variant="title1" color={ink.ink}>
          {copy.today.title}
        </Text>
        <Text variant="caption" color={ink.ink2} style={s.translation}>
          {copy.today.day.reps(totalReps)}
        </Text>
      </Row>
    </View>
  )
}
/** The rail — text only, on a hairline, carrying the one count it has (`--rail-count`). */
function NavRail({ inStream }: { inStream: number }) {
  useLocale()
  return (
    <View style={s.rail}>
      <Row gap={0} wrap style={s.railTrack}>
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
            style={[s.railItem, dest.counted ? s.railItemSelected : null]}
          >
            <Text
              variant="label"
              color={dest.counted ? accent.accentInk : ink.ink2}
              style={s.railText}
            >
              {dest.label}
            </Text>
            {dest.counted && (
              <Text variant="labelSm" color={onDark.primary} style={s.railCount}>
                {inStream}
              </Text>
            )}
          </Pressable>
        ))}
      </Row>
    </View>
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
    <View testID="today-day-list" style={s.block}>
      <SectionLabel>{copy.today.day.heading}</SectionLabel>
      <Card padding={space['4']} radius={radius.xl}>
        <Stack gap={space['3']}>
          {waves.map((wave) => {
            const { title, manner } = copy.today.waves[wave.key]
            const next = wave.position === 'next' && !wave.completed
            const detail = next ? copy.today.day.nextWave(manner, setSize) : manner
            return (
              <DayRow
                key={wave.key}
                appearance="wave"
                time={wave.time}
                title={title}
                meta={wave.completed === true ? undefined : detail}
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
        </Stack>
      </Card>
      <DayRow time={copy.today.day.now} title={copy.today.day.reps(totalReps)} position="passed" />
    </View>
  )
}
/**
 * One row of the day: a time column, what it is, and — when it is next — the way in.
 *
 * Waves sit in the v1.2 stationery card (`today_daily_waves_phrases`). The reps and banked
 * rows stay hairline. The authored row also has a status slot ("done"), rendered when
 * durable course state records the completed wave.
 */
function DayRow({
  time,
  title,
  meta,
  position,
  completed = false,
  appearance = 'rule',
  accessibilityLabel,
  onPress,
}: {
  time: string
  title: string
  meta?: string | undefined
  position: WavePosition
  completed?: boolean | undefined
  /** `wave` is the stationery schedule; `rule` is a hairline fact row. */
  appearance?: 'rule' | 'wave' | undefined
  /**
   * Set when the row would otherwise be read wrong: a number alone in the time column, or a
   * pressable row whose second line is part of what it does.
   */
  accessibilityLabel?: string | undefined
  onPress?: (() => void) | undefined
}) {
  useLocale()
  const next = position === 'next' && !completed
  const receded = appearance === 'wave' && !next
  const timeColor =
    next && appearance === 'wave' ? onDark.primary : next ? accent.accentInk : ink.ink2
  const timeNode =
    appearance === 'wave' ? (
      <View style={[s.timePlate, next ? s.timePlateNext : s.timePlateIdle]}>
        <Text variant="label" color={timeColor} style={s.dayTime}>
          {time}
        </Text>
      </View>
    ) : (
      <Text variant="label" color={timeColor} style={s.dayTime}>
        {time}
      </Text>
    )
  const row = (
    <Row
      align="center"
      gap={NAV.rowGap}
      style={appearance === 'wave' ? (next ? s.waveNext : s.waveRow) : s.dayRow}
    >
      {timeNode}
      <View style={s.grow}>
        <Text
          variant={next ? 'title3' : 'body'}
          color={receded || position === 'passed' ? ink.ink2 : ink.ink}
        >
          {title}
        </Text>
        {meta !== undefined && (
          <Text variant="caption" color={ink.ink2} style={s.dayMeta}>
            {meta}
          </Text>
        )}
        {completed && (
          <Text variant="caption" color={ink.ink2}>
            {copy.today.day.completed}
          </Text>
        )}
      </View>
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
        pressMotion={appearance === 'wave' ? 'deboss' : 'scale'}
        elevation={appearance === 'wave' ? (next ? 'interactive' : 'card') : undefined}
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
      >
        {row}
      </Pressable>
    )
  }
  return (
    <View
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
    <View style={s.block}>
      <Row justify="space-between" align="baseline" wrap style={s.setHeader}>
        <SectionLabel>{copy.today.setHeading(set.length)}</SectionLabel>
        <Text variant="label" color={accent.accentInk}>
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
        set.map((p) => <SetRow key={p.id} phrase={p} />)
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
function SetRow({ phrase }: { phrase: PhraseView }) {
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
      style={s.setRow}
    >
      <Text variant="prose" color={ink.ink} lang="target">
        {phrase.targetText}
      </Text>
      {phrase.translation.length > 0 && (
        <Text variant="caption" color={ink.ink2} style={s.translation}>
          {phrase.translation}
        </Text>
      )}
      <Row justify="space-between" align="center" wrap style={s.setRowTop}>
        <Row gap={space['2']} align="center" wrap style={s.grow}>
          {locked && <Pill size="xs" tone="accent" label={copy.today.lockedBadge} />}
          <Text variant="label" color={ink.ink2} style={s.rowValue}>
            {copy.today.lockInDay(lockInDay, LOCK_IN_DAYS_TO_GRADUATE)}
          </Text>
        </Row>
        {/* Unnamed on purpose: the row's own label already reads
            "…, 0 percent automatic.", so a named bar inside it would announce
            the same number twice. One focusable element per row
            (accessibility.md#every-phrase-row). */}
        <View style={s.setBar}>
          <ProgressBar
            value={phrase.automaticity / 100}
            color={locked ? accent.accent : scale.ladder.bent}
            track={surface.sunken}
          />
        </View>
      </Row>
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
    <DayRow
      time={String(graduated)}
      title={copy.today.day.banked}
      position="passed"
      accessibilityLabel={copy.a11y.today.banked(graduated)}
    />
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
  scroll: { paddingHorizontal: NAV.gutter, paddingTop: space['3.5'], gap: space['6'] },
  /** Take the row's remaining width — the date/title block, a day row's title, a phrase. */
  grow: { flex: 1 },
  block: { gap: space['2'] },
  // ── the chrome ──
  header: {
    paddingHorizontal: NAV.gutter,
    paddingTop: space['1'],
    paddingBottom: space['2.5'],
    gap: space['1'],
  },
  dateLine: { fontSize: NAV_TEXT.date, textTransform: 'none' },
  rail: {
    paddingHorizontal: NAV.gutter,
    paddingBottom: space['3'],
  },
  railTrack: {
    backgroundColor: surface.track,
    borderRadius: radius.pill,
    padding: space['1'],
  },
  railItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['1'],
    minHeight: NAV.railHeight,
    minWidth: NAV.railMinWidth,
    paddingVertical: space['2'],
    borderRadius: radius.pill,
  },
  railItemSelected: {
    backgroundColor: surface.app,
    ...stationeryElevation('card'),
  },
  railText: { textTransform: 'none' },
  railCount: {
    backgroundColor: accent.accent,
    overflow: 'hidden',
    paddingHorizontal: space['1.5'],
    paddingVertical: 2,
    borderRadius: radius.pill,
    textTransform: 'none',
  },
  dayRow: {
    paddingVertical: NAV.rowPadY,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line.default,
  },
  timePlate: {
    minWidth: 48,
    paddingVertical: space['1.5'],
    paddingHorizontal: space['1'],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePlateNext: { backgroundColor: accent.accent },
  timePlateIdle: { backgroundColor: surface.sunken2 },
  waveNext: {
    backgroundColor: surface.app,
    borderRadius: radius.lg,
    paddingVertical: space['2'],
    paddingHorizontal: space['2'],
    ...stationeryElevation('interactive'),
  },
  waveRow: {
    paddingVertical: space['1'],
    paddingHorizontal: space['2'],
  },
  /**
   * Preserve the authored 34-px minimum, but let the full time grow with native font scaling.
   * A fixed width and single-line clamp hid the minutes on Android.
   */
  dayTime: {
    minWidth: NAV.timeWidth,
    flexShrink: 0,
    fontSize: NAV_TEXT.time,
    fontVariant: ['tabular-nums'],
    textTransform: 'none',
  },
  dayMeta: { marginTop: space['0.5'] },
  chevron: { fontSize: NAV_TEXT.chevron },
  setHeader: { paddingBottom: space['1'] },
  setRow: {
    paddingVertical: NAV.rowPadY,
    gap: space['1'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line.default,
  },
  setRowTop: { marginTop: space['1'] },
  setBar: { width: 96, maxWidth: '45%' },
  translation: { fontFamily: typeScale.prose.fontFamily, fontStyle: 'italic' },
  rowValue: { textTransform: 'none' },
})
