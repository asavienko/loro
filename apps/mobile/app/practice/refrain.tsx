import { useLocale } from '../../src/lib/i18n'
/**
 * The Refrain — THE v1 hero. Loro.dc.html:1405–1532, logic 3343–3424.
 *
 * One phrase, six reps, a different MANNER each rep:
 *   Echo → Chorus → Speed → Cloze → Call → Cold
 *
 * The card shows completed practice, not a measured speech score. It visibly warms
 * cold-blue → hot-coral as automaticity climbs, then locks in.
 *
 * Manual confirmation counts practice only. Speech latency stays null until onset is measured.
 *
 * ── How the file is laid out ──
 * `useRefrainSession()` owns the plan, the cursor and the two transitions, and returns the
 * view model. Everything under it renders
 * one band of the screen and nothing else, so a change to the warming card cannot reach the
 * progress counters. Every learner-facing string comes from `src/lib/copy.ts`; every number is a
 * token or lives in this file's `StyleSheet`.
 */

import { useCallback, useEffect, useMemo } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBar } from '../../src/ui/BottomBarContext'
import {
  automaticity,
  DEFAULT_REP_TARGET,
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
  ink,
  onDark,
  radius,
  semantic,
  space,
  surface,
  warming,
} from '../../src/ui/theme'
import { engineContext, refrainEngine, toView, useApp, type PhraseView } from '../../src/store'
import { copy } from '../../src/lib/copy'
import { deviceClock } from '../../src/lib/clock'
/** One warming band's resolved style. The bands are a design token, not a screen decision. */
type WarmingStyle = (typeof warming)[ReturnType<typeof warmBand>]
export default function Refrain() {
  useLocale()
  const insets = useSafeAreaInsets()
  const { height: bottomBarHeight } = useBottomBar()
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
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          gap: space['3.5'],
          // The action bar is absolutely positioned and reserves nothing, so the scroll view
          // clears its measured height, retaining the authored minimum before layout.
          paddingBottom: Math.max(
            insets.bottom + actionBar.clearance.refrain,
            bottomBarHeight + space['4'],
          ),
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
        </Card>

        <RepCounter reps={dayReps} />

        <Text variant="captionSm" color={ink.muted} align="center">
          {copy.refrain.audioNote}
        </Text>
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
  const { session, cursor, done } = useApp((state) => state.refrainResume)
  const setSession = useCallback((session: SessionHandle): void => {
    useApp.setState((state) => ({ refrainResume: { ...state.refrainResume, session } }))
  }, [])
  const setCursor = useCallback((cursor: number): void => {
    useApp.setState((state) => ({ refrainResume: { ...state.refrainResume, cursor } }))
  }, [])
  const setDone = useCallback((done: boolean): void => {
    useApp.setState((state) => ({ refrainResume: { ...state.refrainResume, done } }))
  }, [])
  // Entering the Refrain is one of the moments the day must be re-checked: a learner who
  // opened the app before midnight and starts practising after it needs today's set.
  useEffect(() => {
    ensureRefrainSet()
  }, [ensureRefrainSet])
  useEffect(() => {
    if (useApp.getState().refrainResume.session !== null) return
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
    // This button confirms practice, not speech onset. No microphone measurement exists yet.

    // The engine owns every progress signal, including the ones this screen never shows
    // (rule 5). The store applies the delta; nothing here computes a field.
    void refrainEngine
      .record(
        { ...session, cursor },
        {
          itemId: item.itemId,
          outcome: 'success',
          latencyMs: null,
          hintsUsed: 0,
          at: deviceClock.now(),
        },
      )
      .then(applyDelta)
    // Advance only WITHIN the phrase. On its last rep the cursor stays put, so the card
    // reaches 100% and the learner sees the lock-in — the reward moment of the screen —
    // instead of being moved on before it renders. Leaving the phrase is their tap.
    if (session.plan.items[cursor + 1]?.phraseId === item.phraseId) setCursor(cursor + 1)
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
  useLocale()
  const currentIndex = REFRAIN_MODES.indexOf(mode)
  return (
    <Row gap={space['1']} wrap align="stretch">
      {REFRAIN_MODES.map((m, i) => {
        const isCurrent = m === mode
        const isDone = i < currentIndex
        return (
          <View
            key={m}
            style={[
              s.modeCell,
              Platform.OS === 'web' && { minWidth: 'auto' },
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
  useLocale()
  return (
    <View
      accessibilityLabel={copy.a11y.refrain.card(
        copy.refrain.modes[mode].cue,
        phrase.targetText,
        auto,
      )}
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
  useLocale()
  switch (mode) {
    case 'echo':
    case 'chorus':
    case 'speed':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="target">
            {phrase.targetText}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.translation}
          </Text>
        </>
      )
    case 'cloze':
      return (
        <>
          <Text variant="title1" color={color} align="center" lang="target">
            {cloze(phrase.targetText)}
          </Text>
          <Text variant="caption" color={color} align="center">
            {phrase.translation}
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
            {phrase.translation}
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
  useLocale()
  return (
    <>
      <Row justify="space-between" wrap style={s.meterHeader}>
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

/** Reps done today, against the target. Capped for display; the store keeps the real count. */
function RepCounter({ reps }: { reps: number }) {
  useLocale()
  return (
    <Row justify="space-between">
      <Text variant="labelSm" color={ink.muted}>
        {copy.refrain.repCounter(Math.min(reps, DEFAULT_REP_TARGET), DEFAULT_REP_TARGET)}
      </Text>
      <Dots count={DEFAULT_REP_TARGET} filled={reps} size={7} />
    </Row>
  )
}
/** The one tap of the whole screen: a rep is done. Its mode is core-owned; its label is copy. */
function MicButton({ mode, onPress }: { mode: RefrainMode; onPress: () => void }) {
  useLocale()
  const label = copy.refrain.mic[mode]
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
  useLocale()
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
  useLocale()
  return (
    <ScrollView contentContainerStyle={s.centred}>
      <View style={s.doneTile}>
        <Text style={s.doneEmoji}>{copy.common.flame}</Text>
      </View>
      <Text variant="title2" color={accent.accentInk} lang="target">
        {copy.refrain.done.headline}
      </Text>
      <Text variant="title2" color={ink.ink} align="center">
        {copy.refrain.done.title}
      </Text>
      <Row gap={space['2.5']} wrap align="stretch" style={s.doneStats}>
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
    </ScrollView>
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
  useLocale()
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

const s = StyleSheet.create({
  centred: {
    flexGrow: 1,
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
  doneStat: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { minWidth: 'auto' as const } : {}),
  },
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
function cloze(targetText: string): string {
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
  const words = targetText.split(' ')
  let best = -1
  let bestLen = 0
  words.forEach((w, i) => {
    const bare = w.replace(/[¿?¡!,.]/g, '').toLowerCase()
    if (!stop.has(bare) && bare.length > bestLen) {
      bestLen = bare.length
      best = i
    }
  })
  if (best < 0) return targetText
  return words.map((w, i) => (i === best ? copy.refrain.prompt.clozeBlank : w)).join(' ')
}
