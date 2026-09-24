import { rustCoreFacade } from '../src/store/coreFacade'
import { useLocale } from '../src/lib/i18n'
/**
 * Today — the ritual home, dressed in v1.3 daily-rhythm stationery.
 *
 * Two authored artifacts meet on this screen, and precedence between them is scoped
 * ([design-system.md](../../../docs/design/design-system.md#source-hierarchy)):
 *
 *   • `Loro.dc.html:1316–1391` (`DayLogic` `3295–3341`) owns WHAT is here — a closed, finite set
 *     you can see in full and finish, the three waves, and the rolling window's banked tail.
 *   • `Navigation.dc.html:82–165` owns HOW it is left: the 28-px spine above the header, the
 *     text rail out of the thumb arc, and exactly one filled control. The rail keeps the
 *     authored 20-px chrome gutter.
 *   • `design/design-v1.3/loro_mobile_daily_rhythm_browse_home` restyles the header band
 *     (`h-16`), page column (`px-gutter-sm`), greeting, stats, wave carousel and jump-back
 *     tiles. Invented HTML stats (retention %, BPM, named hour, learner name) are omitted.
 *
 * Navigation's rail stays. The HTML's Rhythm/Explore/Studio/Library dock is not the product nav.
 */

import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useAccount } from '../src/lib/account/runtime'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBar } from '../src/ui/BottomBarContext'
import {
  DEFAULT_REP_TARGET,
  repsToday as repsTodayOf,
  streak as streakOf,
} from '@loro/core'
import { Button, Card, Pressable, Row, Screen, Text } from '../src/ui/primitives'
import { ActionBar } from '../src/ui/components'
import { DESTINATIONS } from '../src/lib/navigation'
import { stationeryElevation } from '../src/ui/elevation'
import { haptics } from '../src/lib/haptics'
import {
  HIT_SLOP,
  MIN_TAP,
  accent,
  actionBar,
  ink,
  onDark,
  radius,
  space,
  surface,
} from '../src/ui/theme'
import {
  PRODUCTION_WAVES,
  PRODUCTION_WAVE_TIMES,
  toView,
  useApp,
  type ProductionWave,
} from '../src/store'
import { copy } from '../src/lib/copy'
import { deviceClock, localTimeLabel } from '../src/lib/clock'
import { useLocalMinute } from '../src/lib/useLocalMinute'
import {
  waveEntryWithResume,
  waveListenProgress,
  waveSchedule,
} from '../src/lib/waves'
import { Greeting } from './_today/Greeting'
import { InsightCard } from './_today/InsightCard'
import { JumpBackIn, JumpBackRest } from './_today/JumpBackIn'
import { StatsBar } from './_today/StatsBar'
import { TodayHeader } from './_today/TodayHeader'
import { WaveCarousel } from './_today/WaveCarousel'
import { nextDueIsNow, rhythmBandFromSchedule, waveClockParts } from './_today/rhythm'
import { GREETING_GAP, PAGE_GUTTER, SECTION_GAP } from './_today/geometry'

type WaveKey = ProductionWave
const RAIL = DESTINATIONS.filter((destination) => destination.rail)

function waveClockLabel(hhmm: string): string {
  const parts = waveClockParts(hhmm)
  return parts === null
    ? hhmm
    : copy.today.rhythm.waveClock(parts.hour, parts.minute, parts.period)
}

export default function Today() {
  useLocale()
  const signedIn = useAccount().session !== null
  const onboarded = useApp((s) => s.onboarded)
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const refrainWaves = useApp((s) => s.refrainWaves)
  const waveListens = useApp((s) => s.waveListens)
  const refrainResume = useApp((s) => s.refrainResume)
  const ensure = useApp((s) => s.ensureRefrainSet)
  const practiceDays = useApp((s) => s.practiceDays)
  const streak = streakOf(practiceDays, deviceClock.streakDay())
  const localMinute = useLocalMinute()
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()

  useEffect(() => {
    if (onboarded) ensure()
  }, [onboarded, ensure, phrases.length, localMinute])
  if (!signedIn) return <Redirect href="/account" />
  if (!onboarded) return <Redirect href="/onboarding" />
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
  const lockedIn = set.filter((p) => p.automaticity >= 100).length
  const totalReps = set.reduce((n, p) => n + p.repsToday, 0)
  const graduated = phrases.filter((p) => p.graduatedAt !== null).length
  const completedWaves = refrainWaves.filter((wave): wave is WaveKey =>
    PRODUCTION_WAVES.includes(wave as WaveKey),
  )
  const now = localTimeLabel()
  const waves = waveSchedule(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    now,
    completedWaves,
  )
  const entry = waveEntryWithResume(
    PRODUCTION_WAVES,
    PRODUCTION_WAVE_TIMES,
    now,
    completedWaves,
    refrainResume,
  )
  const listenProgress = waveListenProgress(waveListens)
  const nextWaveKey = waves.find((wave) => wave.position === 'next')?.key ?? PRODUCTION_WAVES[0]
  const resumeWave = refrainResume.wave ?? nextWaveKey
  const resumeRep =
    refrainResume.session === null
      ? null
      : Math.min(refrainResume.cursor + 1, refrainResume.session.plan.items.length)
  const hasResume = entry.kind === 'resume' && resumeRep !== null && resumeRep > 0
  const canPractice = set.length > 0
  const startWave = (wave = nextWaveKey): void => {
    router.push({ pathname: '/practice/refrain', params: { wave } })
  }
  const continueListening = (): void => {
    router.push('/practice/stream')
  }
  const band = rhythmBandFromSchedule(waves)
  const nextSlot = waves.find((wave) => wave.position === 'next')
  const nextDue =
    nextSlot === undefined
      ? copy.today.day.now
      : nextDueIsNow(nextSlot.time, now)
        ? copy.today.day.now
        : waveClockLabel(nextSlot.time)
  return (
    <Screen>
      <View>
        <TodayHeader streak={streak} targetName={copy.today.rhythm.target} />
        <NavRail inStream={phrases.length} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
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
              haptics.select()
              router.push({ pathname: '/practice/refrain', params: { wave: resumeWave } })
            }}
          />
        )}
        <View style={s.greetingBlock}>
          <Greeting band={band} dueCount={set.length} />
          <StatsBar
            totalReps={totalReps}
            lockedLabel={copy.today.rhythm.lockedValue(lockedIn, set.length)}
            nextDue={nextDue}
          />
        </View>
        <WaveCarousel
          waves={waves}
          setSize={set.length}
          totalReps={totalReps}
          listenProgress={entry.kind === 'complete' ? undefined : listenProgress}
          onStartWave={canPractice && entry.kind !== 'complete' ? startWave : undefined}
        />
        <JumpBackIn set={set} lockedIn={lockedIn} />
        <InsightCard graduated={graduated} />
        <JumpBackRest set={set} />
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
                    : copy.today.cta.keepListening
          }
          disabled={!canPractice}
          accessibilityHint={
            canPractice ? copy.a11y.today.startHint(set.length, DEFAULT_REP_TARGET) : undefined
          }
          onPress={() => {
            haptics.confirm()
            if (entry.kind === 'resume' || entry.kind === 'ready')
              startWave(entry.kind === 'resume' ? entry.wave : entry.wave.key)
            else continueListening()
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
    <Pressable feedback="row" pressMotion="deboss" accessibilityLabel={label} onPress={onPress}>
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

function NavRail({ inStream }: { inStream: number }) {
  useLocale()
  return (
    <View testID="today-rail" style={s.rail}>
      <Row gap={0} wrap style={s.railTrack}>
        {RAIL.map((dest) => (
          <Pressable
            key={dest.href}
            feedback="row"
            pressMotion="deboss"
            accessibilityLabel={
              dest.counted ? copy.a11y.today.railCount(dest.label, inStream) : dest.label
            }
            onPress={() => {
              haptics.select()
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

const NAV = {
  gutter: space['5'],
  railHeight: 34,
  railMinWidth: MIN_TAP - HIT_SLOP * 2,
} as const

const s = StyleSheet.create({
  scroll: { paddingHorizontal: PAGE_GUTTER, paddingTop: space['1'], gap: SECTION_GAP },
  greetingBlock: { gap: GREETING_GAP },
  grow: { flex: 1 },
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
})
