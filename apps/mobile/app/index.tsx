/**
 * Today — the ritual home. Loro.dc.html:1316–1391.
 *
 * A CLOSED, finite set you can see in full and finish. No queue, no hidden
 * algorithm: you always see today.
 *
 * The screen is a composition of five blocks, each named for what the learner sees and each
 * defined below: the header, today's set, the three waves, the stats, and the nav row. The
 * default export derives the numbers and lays those five out; nothing in it draws.
 */

import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  DEFAULT_REP_TARGET,
  automaticity,
  repsToday as repsTodayOf,
  streak as streakOf,
} from '@loro/core'
import {
  Button,
  Card,
  CardHeader,
  Divider,
  Pill,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import { ActionBar, StatRow } from '../src/ui/components'
import {
  accent,
  actionBar,
  border,
  ink,
  line,
  radius,
  scale,
  space,
  surface,
} from '../src/ui/theme'
import { toView, useApp, type PhraseView } from '../src/store'
import { copy } from '../src/lib/copy'
import { deviceClock, localWeekdayLabel } from '../src/lib/clock'

/** Full automaticity: six reps in one day. The badge, the bar's colour and the count agree. */
const isLockedIn = (p: Pick<PhraseView, 'automaticity'>): boolean => p.automaticity >= 100

export default function Today() {
  const onboarded = useApp((s) => s.onboarded)
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const ensure = useApp((s) => s.ensureRefrainSet)
  const practiceDays = useApp((s) => s.practiceDays)
  // Derived, never stored — the same function the widget will call (ADR-0002).
  const streak = streakOf(practiceDays, deviceClock.streakDay())
  const insets = useSafeAreaInsets()

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
        automaticity: automaticity(reps, DEFAULT_REP_TARGET),
      }
    })

  const lockedIn = set.filter(isLockedIn).length
  const totalReps = set.reduce((n, p) => n + p.repsToday, 0)
  const graduated = phrases.filter((p) => p.graduatedAt !== null).length

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: insets.top + space['3'],
            // `ActionBar` is absolutely positioned and reserves nothing, so the clearance
            // for it is this screen's to leave. See `actionBar.clearance`.
            paddingBottom: insets.bottom + actionBar.clearance.today,
          },
        ]}
      >
        <TodayHeader streak={streak} />
        <TodaySetList set={set} lockedIn={lockedIn} />
        <WaveList lockedIn={lockedIn} />

        <StatRow
          stats={[
            { value: String(totalReps), label: copy.today.stats.repsToday },
            { value: String(phrases.length), label: copy.today.stats.inYourStream },
            { value: String(graduated), label: copy.today.stats.graduated },
          ]}
        />

        <Divider />

        <NavRow />
      </ScrollView>

      <ActionBar>
        <Button
          label={set.length === 0 ? copy.today.cta.empty : copy.today.cta.start}
          disabled={set.length === 0}
          accessibilityHint={copy.a11y.today.startHint(set.length, DEFAULT_REP_TARGET)}
          onPress={() => {
            router.push('/practice/refrain')
          }}
        />
      </ActionBar>
    </Screen>
  )
}

/** The weekday line, the title, and the streak capsule. */
function TodayHeader({ streak }: { streak: number }) {
  return (
    <Row justify="space-between" align="flex-end">
      <View>
        <Text variant="labelSm" color={ink.muted}>
          {copy.today.subtitle(localWeekdayLabel())}
        </Text>
        <Text variant="title3" color={ink.ink}>
          {copy.today.title}
        </Text>
      </View>
      <Pill
        size="capsule"
        tone="accent"
        emoji={copy.common.flame}
        // A learner on day zero sees an invitation, not a zero.
        label={streak === 0 ? copy.common.noValue : String(streak)}
      />
    </Row>
  )
}

/** Today's set: closed, finite, finishable. Owns its own empty state. */
function TodaySetList({ set, lockedIn }: { set: readonly PhraseView[]; lockedIn: number }) {
  return (
    <Card>
      <CardHeader
        title={copy.today.setHeading(set.length)}
        meta={copy.today.lockedIn(lockedIn, set.length)}
      />

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
        <Stack gap={space['2.5']}>
          {set.map((p) => (
            <SetRow key={p.id} phrase={p} />
          ))}
        </Stack>
      )}
    </Card>
  )
}

/**
 * One phrase in today's set.
 *
 * Not a `PhraseRow`: no English line, no emoji, no container of its own, and a progress bar
 * where that component has a trailing slot (ui-api.md §4).
 */
function SetRow({ phrase }: { phrase: PhraseView }) {
  const locked = isLockedIn(phrase)
  return (
    <Pressable
      feedback="row"
      accessibilityLabel={copy.a11y.today.phraseRow(phrase.es, phrase.automaticity)}
      accessibilityHint={copy.a11y.common.opensPhraseDetails}
      onPress={() => {
        router.push(`/phrase/${phrase.id}`)
      }}
    >
      <Row justify="space-between" style={s.setRow}>
        <Text variant="caption" color={ink.ink} numberOfLines={1} lang="es" style={s.grow}>
          {phrase.es}
        </Text>
        {locked && <Pill size="xs" tone="accent" label={copy.today.lockedBadge} />}
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
 * The three waves.
 *
 * The ORDER is structure and lives here; each wave's label, subtitle and displayed time are
 * copy (`copy.today.waves`). Readiness keys off the index — the morning wave is always ready,
 * the other two open once something is locked in. Whether those times are honest, and whether
 * readiness should come from the scheduler rather than a position in this array, is plans/50's
 * question: unchanged here on purpose.
 */
const WAVES = ['morning', 'midday', 'evening'] as const

function WaveList({ lockedIn }: { lockedIn: number }) {
  return (
    <Stack gap={space['2']}>
      <SectionLabel>{copy.today.wavesHeading}</SectionLabel>
      {WAVES.map((wave, i) => (
        <WaveRow key={wave} wave={copy.today.waves[wave]} ready={i === 0 || lockedIn > 0} />
      ))}
    </Stack>
  )
}

function WaveRow({
  wave,
  ready,
}: {
  wave: (typeof copy.today.waves)[(typeof WAVES)[number]]
  ready: boolean
}) {
  return (
    <Row gap={WAVE.gap} style={[s.wave, ready ? s.waveReady : s.wavePending]}>
      <View style={[s.waveMark, { borderColor: ready ? accent.accent : ink.muted2 }]}>
        <Text variant="labelSm" color={ready ? accent.accentInk : ink.muted2}>
          {ready ? copy.common.marks.dot : copy.common.marks.ring}
        </Text>
      </View>
      <View style={s.grow}>
        <Text variant="caption" color={ink.ink}>
          {wave.label}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {wave.sub}
        </Text>
      </View>
      <Text variant="labelSm" color={ink.muted}>
        {wave.time}
      </Text>
    </Row>
  )
}

/**
 * The wave row's own metrics — an 11-px inset with an 11-px gap, and a 26-px rail mark whose
 * radius is half of it. One call site, so they stay here rather than becoming tokens.
 */
const WAVE = { gap: 11, padding: 11, mark: 26 } as const

/** The three secondary destinations, side by side and equally wide. */
const NAV = [
  { label: copy.common.stream, href: '/practice/stream' },
  { label: copy.common.progress, href: '/progress' },
  { label: copy.today.actions.add, href: '/add' },
] as const

function NavRow() {
  return (
    <Row gap={space['2.5']}>
      {NAV.map((dest) => (
        <View key={dest.href} style={s.grow}>
          <Button
            label={dest.label}
            variant="secondary"
            onPress={() => {
              router.push(dest.href)
            }}
          />
        </View>
      ))}
    </Row>
  )
}

const s = StyleSheet.create({
  scroll: { padding: space['4'], gap: space['4'] },
  /** Take the row's remaining width — the Spanish line, the wave's two lines, a nav button. */
  grow: { flex: 1 },
  setRow: { marginBottom: 5 },
  wave: { borderRadius: radius.xl, padding: WAVE.padding },
  waveReady: {
    backgroundColor: accent.tint,
    borderWidth: border.selected,
    borderColor: accent.accent,
  },
  wavePending: {
    backgroundColor: surface.card,
    borderWidth: border.hairline,
    borderColor: line.default,
  },
  waveMark: {
    width: WAVE.mark,
    height: WAVE.mark,
    borderRadius: WAVE.mark / 2,
    borderWidth: border.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
