/**
 * The Refrain — THE v1 hero. Loro.dc.html:1405–1532, logic 3343–3424.
 *
 * One phrase, six reps, a different MANNER each rep:
 *   Echo → Chorus → Speed → Cloze → Call → Cold
 *
 * What moves on screen is EFFORT DROPPING, not a score. The card visibly warms
 * cold-blue → hot-coral as automaticity climbs, then locks in.
 *
 * Latency is MEASURED (rep start → tap). Never computed from the rep index.
 *
 * ── How the file is laid out ──
 * `useRefrainSession()` is the state machine: it owns the plan, the cursor, the measured
 * latencies and the two transitions, and returns the view model. Everything under it renders
 * one band of the screen and nothing else, so a change to the warming card cannot reach the
 * effort bars. Every learner-facing string comes from `src/lib/copy.ts`; every number is a
 * token or lives in this file's `StyleSheet`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  automaticity,
  DEFAULT_REP_TARGET,
  effortLabel,
  micLabelForMode,
  modelRateForMode,
  REFRAIN_MODES,
  repsToday as repsTodayOf,
  warmBand,
  type RefrainMode,
  type SessionHandle,
} from '@loro/core'
import {
  Button,
  Card,
  Dots,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  Text,
} from '../../src/ui/primitives'
import { ActionBar, EmptyState } from '../../src/ui/components'
import {
  accent,
  actionBar,
  barRadius,
  ink,
  line,
  onDark,
  radius,
  semantic,
  space,
  surface,
  warming,
} from '../../src/ui/theme'
import { engineContext, refrainEngine, toView, useApp, type PhraseView } from '../../src/store'
import { copy } from '../../src/lib/copy'
import { formatLatency } from '../../src/lib/format'
import { deviceClock } from '../../src/lib/clock'

/** One warming band's resolved style. The bands are a design token, not a screen decision. */
type WarmingStyle = (typeof warming)[ReturnType<typeof warmBand>]

export default function Refrain() {
  const insets = useSafeAreaInsets()
  const session = useRefrainSession()
  const { set, phrase, mode, auto, dayReps, locked, phraseNumber } = session

  if (set.length === 0) {
    return (
      <Screen>
        <EmptyState
          title={copy.refrain.empty.title}
          body={copy.refrain.empty.body}
          action={{
            label: copy.common.addPhrases,
            onPress: () => {
              router.replace('/add')
            },
          }}
        />
      </Screen>
    )
  }

  if (session.finished) {
    const day = deviceClock.localDay()
    return (
      <Screen>
        <DoneState
          worked={set.length}
          totalReps={set.reduce((n, p) => n + repsTodayOf(p, day), 0)}
        />
      </Screen>
    )
  }

  if (phrase === undefined) return null

  // Hoisted: the guard and the sentence read the same value, and `modelRate` takes a number.
  const rate = modelRateForMode(mode)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          gap: space['3.5'],
          // The action bar is absolutely positioned and reserves nothing, so the scroll view
          // leaves its own clearance. The number is a guess, not a measurement — see
          // `actionBar` in src/ui/tokens/control.ts; a follow-up plan owns making it real.
          paddingBottom: insets.bottom + actionBar.clearance.refrain,
        }}
      >
        <Row justify="space-between">
          <Text variant="caption" color={ink.ink}>
            {copy.refrain.phraseCounter(phraseNumber, set.length)}
          </Text>
          <Dots count={set.length} filled={phraseNumber - 1} />
        </Row>

        <ModeStrip mode={mode} />

        <WarmingCard mode={mode} phrase={phrase} auto={auto} bandStyle={session.bandStyle} />

        <Card>
          <AutomaticityMeter auto={auto} />
          {session.history.length > 0 && (
            <EffortChart
              history={session.history}
              lastLatency={session.lastLatency}
              summary={effortLabel(dayReps, auto)}
            />
          )}
        </Card>

        <RepCounter reps={dayReps} />

        {rate !== null && (
          <Text variant="captionSm" color={ink.muted} align="center">
            {copy.refrain.modelRate(rate)}
          </Text>
        )}
      </ScrollView>

      <ActionBar gap={space['2.5']}>
        {locked ? (
          <>
            <LockedInBanner />
            <Button
              label={
                phraseNumber >= set.length ? copy.refrain.locked.finish : copy.refrain.locked.next
              }
              onPress={session.nextPhrase}
            />
          </>
        ) : (
          <MicButton mode={mode} onPress={session.doRep} />
        )}
      </ActionBar>
    </Screen>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The session
// ─────────────────────────────────────────────────────────────────────────────

interface RefrainSession {
  /** Today's frozen set, in the order the learner will see it. */
  set: PhraseView[]
  /** The phrase on screen. `undefined` while the engine's plan is still resolving. */
  phrase: PhraseView | undefined
  /** Which phrase of the set is on screen, 1-based. */
  phraseNumber: number
  mode: RefrainMode
  /** Reps recorded for this phrase TODAY, read from the store. */
  dayReps: number
  auto: number
  bandStyle: WarmingStyle
  locked: boolean
  /** The last MEASURED rep, or `null` when nothing has been measured yet. */
  lastLatency: number | null
  /** The last four reps. `null` is an unmeasured rep and draws as a gap. */
  history: (number | null)[]
  /** The learner tapped through the set, or the plan had nothing left to do. */
  finished: boolean
  doRep: () => void
  nextPhrase: () => void
}

/**
 * The engine plans the session; this hook holds the plan and hands the deltas back.
 * The mode sequence, the rep target, and which reps remain today are all the
 * RefrainEngine's decisions — the screen used to re-derive them, which is how the
 * card's warmth and the stored value came to disagree.
 */
function useRefrainSession(): RefrainSession {
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const applyDelta = useApp((s) => s.applyDelta)
  const ensureRefrainSet = useApp((s) => s.ensureRefrainSet)

  const [session, setSession] = useState<SessionHandle | null>(null)
  const [cursor, setCursor] = useState(0)
  const [lastLatency, setLastLatency] = useState<number | null>(null)
  const [history, setHistory] = useState<(number | null)[]>([])
  const [done, setDone] = useState(false)
  // Monotonic, so a wall-clock jump can't corrupt a measurement.
  const repStart = useRef<number>(deviceClock.now())

  // Entering the Refrain is one of the moments the day must be re-checked: a learner who
  // opened the app before midnight and starts practising after it needs today's set.
  useEffect(() => {
    ensureRefrainSet()
  }, [ensureRefrainSet])

  useEffect(() => {
    let cancelled = false
    void refrainEngine.plan(engineContext()).then((plan) => {
      if (cancelled) return
      setSession({ sessionId: `refrain:${String(plan.items.length)}`, plan, cursor: 0 })
      setCursor(0)
    })
    return () => {
      cancelled = true
    }
    // Re-planned when the day's set changes, not on every rep: the plan is the day's
    // work, and re-planning mid-phrase would restart the mode sequence.
  }, [refrainSet])

  const item = session?.plan.items[cursor]

  const storePhrase = useMemo(
    () => (item === undefined ? undefined : phrases.find((p) => p.id === item.phraseId)),
    [item, phrases],
  )
  const phrase = storePhrase === undefined ? undefined : toView(storePhrase)

  const mode = (item?.mode ?? 'echo') as RefrainMode

  /**
   * Automaticity comes from the STORE's rep count for TODAY, not from a counter local to
   * this visit. The two disagree the moment a learner returns to a phrase later the same
   * day: local state starts at 0 while the store says 4 of 6, and the number on screen
   * was the wrong one. `repsToday` is read through the day guard, so a stale counter from
   * yesterday reads as 0 rather than inflating the card.
   */
  const dayReps = storePhrase === undefined ? 0 : repsTodayOf(storePhrase, deviceClock.localDay())
  const auto = automaticity(dayReps, DEFAULT_REP_TARGET)
  const band = warmBand(auto)
  const bandStyle = warming[band]
  const locked = auto >= 100

  const doRep = useCallback(() => {
    if (session === null || item === undefined || locked) return
    // MEASURED: from when the prompt settled to when the learner confirmed.
    const measured = deviceClock.now() - repStart.current
    setLastLatency(measured)
    setHistory((h) => [...h.slice(-3), measured])

    // The engine owns every progress signal, including the ones this screen never shows
    // (rule 5). The store applies the delta; nothing here computes a field.
    void refrainEngine
      .record(
        { ...session, cursor },
        {
          itemId: item.itemId,
          outcome: 'success',
          latencyMs: measured,
          hintsUsed: 0,
          at: deviceClock.now(),
        },
      )
      .then(applyDelta)

    // Advance only WITHIN the phrase. On its last rep the cursor stays put, so the card
    // reaches 100% and the learner sees the lock-in — the reward moment of the screen —
    // instead of being moved on before it renders. Leaving the phrase is their tap.
    if (session.plan.items[cursor + 1]?.phraseId === item.phraseId) setCursor(cursor + 1)
    repStart.current = deviceClock.now()
  }, [session, item, cursor, locked, applyDelta])

  /** Jump to the first item of the next phrase in the plan. */
  const nextPhrase = useCallback(() => {
    const items = session?.plan.items ?? []
    const current = items[cursor]?.phraseId
    const nextIndex = items.findIndex((i, n) => n > cursor && i.phraseId !== current)
    if (nextIndex < 0) {
      setDone(true)
      return
    }
    setCursor(nextIndex)
    setLastLatency(null)
    setHistory([])
    repStart.current = deviceClock.now()
  }, [session, cursor])

  const set = useMemo(
    () =>
      refrainSet
        .map((id) => phrases.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .map(toView),
    [refrainSet, phrases],
  )

  // Which phrase of the day's set is on screen. Read from the frozen set rather than
  // counted locally, so it stays right when a session resumes part-way through.
  const phraseNumber =
    item === undefined ? 1 : Math.max(1, set.findIndex((p) => p.id === item.phraseId) + 1)

  // The plan is the day's remaining work. Empty means the set is already warmed up —
  // a distinct state from "nothing in rotation", and the learner should see the finish,
  // not an empty screen.
  const exhausted = session !== null && cursor >= session.plan.items.length

  return {
    set,
    phrase,
    phraseNumber,
    mode,
    dayReps,
    auto,
    bandStyle,
    locked,
    lastLatency,
    history,
    finished: done || exhausted,
    doRep,
    nextPhrase,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The screen, band by band
// ─────────────────────────────────────────────────────────────────────────────

/** Mode strip: done · current · upcoming, in the engine's own order. */
function ModeStrip({ mode }: { mode: RefrainMode }) {
  const currentIndex = REFRAIN_MODES.indexOf(mode)
  return (
    <Row gap={space['1']}>
      {REFRAIN_MODES.map((m, i) => {
        const isCurrent = m === mode
        const isDone = i < currentIndex
        return (
          <View
            key={m}
            style={[
              s.modeCell,
              {
                backgroundColor: isCurrent ? accent.accent : isDone ? accent.wash : surface.sunken,
              },
            ]}
          >
            <Text
              variant="labelSm"
              color={isCurrent ? onDark.primary : isDone ? accent.accentInk : ink.ink3}
            >
              {copy.refrain.modes[m].label}
            </Text>
          </View>
        )
      })}
    </Row>
  )
}

/** THE WARMING CARD — the product's core feedback signal. */
function WarmingCard({
  mode,
  phrase,
  auto,
  bandStyle,
}: {
  mode: RefrainMode
  phrase: PhraseView
  auto: number
  bandStyle: WarmingStyle
}) {
  return (
    <View
      accessibilityLabel={copy.a11y.refrain.card(copy.refrain.modes[mode].cue, phrase.es, auto)}
      style={[
        s.warmingCard,
        {
          // The gradient bands render as their base colour; a real gradient lands
          // with Skia. The COLOUR PROGRESSION is the information, and it's here.
          backgroundColor: bandStyle.bg.startsWith('linear-gradient')
            ? (/#[0-9a-f]{6}/i.exec(bandStyle.bg)?.[0] ?? surface.card)
            : bandStyle.bg,
        },
      ]}
    >
      <Row gap={space['1.5']}>
        <Text variant="caption">{copy.refrain.modes[mode].icon}</Text>
        <Text variant="labelSm" color={bandStyle.text}>
          {copy.refrain.modes[mode].cue}
        </Text>
      </Row>

      <WarmingPrompt mode={mode} phrase={phrase} color={bandStyle.text} />
    </View>
  )
}

/** Prompt content is mode-dependent: full → cloze → meaning → nothing. */
function WarmingPrompt({
  mode,
  phrase,
  color,
}: {
  mode: RefrainMode
  phrase: PhraseView
  color: string
}) {
  switch (mode) {
    case 'echo':
    case 'chorus':
    case 'speed':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="es">
            {phrase.es}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.en}
          </Text>
        </>
      )
    case 'cloze':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="es">
            {cloze(phrase.es)}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.en}
          </Text>
        </>
      )
    case 'call':
      return (
        <>
          <Text variant="labelSm" color={color}>
            {copy.refrain.prompt.callLabel}
          </Text>
          <Text variant="title2" color={color} align="center">
            {phrase.en}
          </Text>
        </>
      )
    case 'cold':
      return (
        <>
          <Text style={s.coldGlyph}>{copy.refrain.modes.cold.icon}</Text>
          <Text variant="caption" color={color} align="center">
            {copy.refrain.prompt.coldLabel}
          </Text>
        </>
      )
  }
}

/** Automaticity, as a percentage and as a bar. */
function AutomaticityMeter({ auto }: { auto: number }) {
  return (
    <>
      <Row justify="space-between" style={s.meterHeader}>
        <Text variant="labelSm" color={ink.ink}>
          {copy.refrain.automaticity.label}
        </Text>
        <Text variant="labelSm" color={accent.accentInk}>
          {copy.refrain.automaticity.percent(auto)}
        </Text>
      </Row>
      {/* Named: this bar IS the product's core feedback signal, and accessibility.md
          requires the Refrain expose automaticity "as a progress bar with a
          percentage". Unnamed it announced as an anonymous progressbar. */}
      <ProgressBar
        value={auto / 100}
        height={9}
        track={surface.sunken}
        label={copy.refrain.automaticity.label}
      />
    </>
  )
}

/**
 * The falling effort: one bar per recent rep, and the read-out beside them.
 *
 * `summary` is the visible text summary every chart in the app carries
 * (`scripts/a11yChecks.ts` checks for it) — here the engine's own `effortLabel`.
 */
function EffortChart({
  history,
  lastLatency,
  summary,
}: {
  history: readonly (number | null)[]
  lastLatency: number | null
  summary: string
}) {
  // null hides the read-out — never an estimate.
  const latency = formatLatency(lastLatency)
  return (
    <Row gap={space['2.5']} style={s.effortRow}>
      {/* Effort bars: gaps for unmeasured reps, never interpolation. */}
      <Row gap={EFFORT.gap} align="flex-end" style={s.effortBars}>
        {history.map((ms, i) => (
          <View
            key={i}
            style={[
              s.effortBar,
              {
                height:
                  ms === null
                    ? EFFORT.gapHeight
                    : Math.max(EFFORT.minFill, Math.min(EFFORT.height, ms / EFFORT.msPerPixel)),
                backgroundColor: ms === null ? line.default : line.stronger,
              },
            ]}
          />
        ))}
      </Row>
      <View style={s.effortMeta}>
        <Row gap={space['1.5']}>
          {latency !== null && (
            <Text variant="caption" color={ink.ink}>
              {latency}
            </Text>
          )}
          <Text variant="labelSm" color={semantic.success.text}>
            {copy.refrain.effortLabel}
          </Text>
        </Row>
        <Text variant="captionSm" color={ink.muted}>
          {summary}
        </Text>
      </View>
    </Row>
  )
}

/** Reps done today, against the target. Capped for display; the store keeps the real count. */
function RepCounter({ reps }: { reps: number }) {
  return (
    <Row justify="space-between">
      <Text variant="labelSm" color={ink.muted}>
        {copy.refrain.repCounter(Math.min(reps, DEFAULT_REP_TARGET), DEFAULT_REP_TARGET)}
      </Text>
      <Dots count={DEFAULT_REP_TARGET} filled={reps} size={7} />
    </Row>
  )
}

/** The one tap of the whole screen: a rep is done. Its label is the mode's, from the engine. */
function MicButton({ mode, onPress }: { mode: RefrainMode; onPress: () => void }) {
  const label = micLabelForMode(mode)
  return (
    <Pressable
      feedback="button"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={copy.refrain.modes[mode].cue}
      style={s.mic}
    >
      <Text variant="title3" color={onDark.primary}>
        {label}
      </Text>
    </Pressable>
  )
}

/** The reward moment: this phrase is automatic today. */
function LockedInBanner() {
  return (
    <Row gap={space['2.5']} style={s.lockedBanner}>
      <Text style={s.lockedGem}>{copy.refrain.locked.gem}</Text>
      <View style={s.lockedBody}>
        <Text variant="caption" color={semantic.success.text}>
          {copy.refrain.locked.title}
        </Text>
        <Text variant="captionSm" color={semantic.successMeta.text}>
          {copy.refrain.locked.body}
        </Text>
      </View>
    </Row>
  )
}

/**
 * The finish.
 *
 * NOT an `EmptyState`, though it is the same centred box: it carries two `title2` lines (one
 * Spanish), an 88-px tile whose 42-px emoji is off `EmojiTile`'s 0.48 ratio, two counters, and
 * a full-width button. Routing it through `EmptyState` would silently restyle all four.
 */
function DoneState({ worked, totalReps }: { worked: number; totalReps: number }) {
  return (
    <View style={s.centred}>
      <View style={s.doneTile}>
        <Text style={s.doneEmoji}>{copy.common.flame}</Text>
      </View>
      <Text variant="title2" color={accent.accentInk} lang="es">
        {copy.refrain.done.headline}
      </Text>
      <Text variant="title2" color={ink.ink} align="center">
        {copy.refrain.done.title}
      </Text>
      <Row gap={space['2.5']} style={s.doneStats}>
        <DoneStat value={worked} label={copy.refrain.done.workedLabel} />
        <DoneStat value={totalReps} label={copy.common.repsToday} />
      </Row>
      <View style={s.doneCta}>
        <Button
          label={copy.refrain.done.cta}
          onPress={() => {
            router.replace('/')
          }}
        />
      </View>
    </View>
  )
}

/**
 * One of the finish screen's two counters. Deliberately NOT `StatTile`.
 *
 * `StatTile` renders its number at `title2` where these are `title3`, and it groups the pair
 * into one accessible node named `"<label>: <value>"`, which these do not have. Both are
 * arguably improvements, and both change what a learner sees and hears — so they stay as they
 * are. Unifying them is a design decision, not a refactor (plans/34).
 */
function DoneStat({ value, label }: { value: number; label: string }) {
  return (
    <Card style={s.doneStat}>
      <Text variant="title3" color={ink.ink}>
        {value}
      </Text>
      <Text variant="labelSm" color={ink.muted}>
        {label}
      </Text>
    </Card>
  )
}

/**
 * The effort chart's geometry, in one place.
 *
 * `msPerPixel` is the only judgement in it: 90 ms to a pixel puts a slow first rep at the top
 * of the 28-px chart and a fast one near the floor. An unmeasured rep draws `gapHeight` — a
 * visible gap, never an interpolated bar.
 */
const EFFORT = { width: 7, gap: 3, height: 28, minFill: 6, gapHeight: 3, msPerPixel: 90 } as const

const s = StyleSheet.create({
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['5'],
    gap: space['3'],
  },
  modeCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space['2'],
    borderRadius: radius.md,
  },
  warmingCard: {
    borderRadius: radius['2xl'],
    padding: 26,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['2'],
  },
  coldGlyph: { fontSize: 32 },
  meterHeader: { marginBottom: space['2'] },
  effortRow: { marginTop: space['3'] },
  effortBars: { height: EFFORT.height },
  effortBar: { width: EFFORT.width, borderRadius: barRadius },
  effortMeta: { flex: 1 },
  mic: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBanner: {
    backgroundColor: semantic.success.bg,
    borderRadius: radius.xl,
    padding: space['3'],
  },
  lockedGem: { fontSize: 20 },
  lockedBody: { flex: 1 },
  doneTile: {
    width: 88,
    height: 88,
    borderRadius: radius['3xl'],
    backgroundColor: accent.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEmoji: { fontSize: 42 },
  doneStats: { width: '100%', marginTop: space['3'] },
  doneStat: { flex: 1, alignItems: 'center' },
  doneCta: { width: '100%', marginTop: space['3'] },
})

/**
 * Blank the most informative content word — never an article or preposition.
 *
 * Kept here, and kept as written. It disagrees with the `clozeMask: [1]` the RefrainEngine
 * records, which is a real defect owned by plans/05 — but the disagreement is about WHICH word
 * the learner sees blanked, so "fixing" it here would change the screen rather than reconcile
 * the two. See plans/52 §"Defects found".
 */
function cloze(es: string): string {
  const stop = new Set([
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'de',
    'del',
    'a',
    'al',
    'en',
    'por',
    'para',
    'y',
    'o',
    'que',
    'me',
    'te',
    'se',
    'lo',
  ])
  const words = es.split(' ')
  let best = -1
  let bestLen = 0
  words.forEach((w, i) => {
    const bare = w.replace(/[¿?¡!,.]/g, '').toLowerCase()
    if (!stop.has(bare) && bare.length > bestLen) {
      bestLen = bare.length
      best = i
    }
  })
  if (best < 0) return es
  return words.map((w, i) => (i === best ? copy.refrain.prompt.clozeBlank : w)).join(' ')
}
