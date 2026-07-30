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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  automaticity,
  DEFAULT_REP_TARGET,
  effortLabel,
  micLabelForMode,
  modelRateForMode,
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
import {
  accent,
  ink,
  line,
  onDark,
  radius,
  semantic,
  space,
  surface,
  warming,
} from '../../src/ui/theme'
import { engineContext, refrainEngine, toView, useApp } from '../../src/store'
import { formatLatency } from '../../src/lib/format'
import { deviceClock } from '../../src/lib/clock'

const MODE_CUE: Record<RefrainMode, string> = {
  echo: 'Hear it, then say it back',
  chorus: 'Say it in unison — ride the beat',
  speed: 'Again, faster — keep the groove',
  cloze: 'Fill the gap out loud',
  call: 'Say the Spanish for the cue',
  cold: 'From memory — no model',
}

const MODE_ICON: Record<RefrainMode, string> = {
  echo: '🔁',
  chorus: '🎵',
  speed: '⚡',
  cloze: '◻️',
  call: '💬',
  cold: '❄️',
}

const MODES: RefrainMode[] = ['echo', 'chorus', 'speed', 'cloze', 'call', 'cold']

export default function Refrain() {
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const refrainSet = useApp((s) => s.refrainSet)
  const applyDelta = useApp((s) => s.applyDelta)
  const ensureRefrainSet = useApp((s) => s.ensureRefrainSet)

  /**
   * The engine plans the session; this screen renders it and hands the deltas back.
   * The mode sequence, the rep target, and which reps remain today are all the
   * RefrainEngine's decisions — the screen used to re-derive them, which is how the
   * card's warmth and the stored value came to disagree.
   */
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

  if (set.length === 0) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space['5'],
            gap: space['3'],
          }}
        >
          <Text variant="title3" color={ink.ink} align="center">
            Nothing in rotation yet
          </Text>
          <Text variant="caption" color={ink.muted} align="center">
            Add a few phrases and today&apos;s set builds itself.
          </Text>
          <Button
            label="Add phrases"
            onPress={() => {
              router.replace('/add')
            }}
          />
        </View>
      </Screen>
    )
  }

  // The plan is the day's remaining work. Empty means the set is already warmed up —
  // a distinct state from "nothing in rotation", and the learner should see the finish,
  // not an empty screen.
  const exhausted = session !== null && cursor >= session.plan.items.length

  if (done || exhausted) {
    const day = deviceClock.localDay()
    const totalReps = set.reduce((n, p) => n + repsTodayOf(p, day), 0)
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space['5'],
            gap: space['3'],
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius['3xl'],
              backgroundColor: accent.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 42 }}>🔥</Text>
          </View>
          <Text variant="title2" color={accent.accentInk} lang="es">
            ¡Hecho! Today is done
          </Text>
          <Text variant="title2" color={ink.ink} align="center">
            Today&apos;s set is warmed up
          </Text>
          <Row gap={space['2.5']} style={{ width: '100%', marginTop: space['3'] }}>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="title3" color={ink.ink}>
                {set.length}
              </Text>
              <Text variant="labelSm" color={ink.muted}>
                worked
              </Text>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="title3" color={ink.ink}>
                {totalReps}
              </Text>
              <Text variant="labelSm" color={ink.muted}>
                reps today
              </Text>
            </Card>
          </Row>
          <View style={{ width: '100%', marginTop: space['3'] }}>
            <Button
              label="Back to today"
              onPress={() => {
                router.replace('/')
              }}
            />
          </View>
        </View>
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
          paddingBottom: insets.bottom + 120,
        }}
      >
        <Row justify="space-between">
          <Text variant="caption" color={ink.ink}>
            Phrase {phraseNumber} / {set.length}
          </Text>
          <Dots count={set.length} filled={phraseNumber - 1} />
        </Row>

        {/* ── Mode strip: done · current · upcoming ── */}
        <Row gap={4}>
          {MODES.map((m, i) => {
            const isCurrent = m === mode
            const isDone = i < MODES.indexOf(mode)
            return (
              <View
                key={m}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  backgroundColor: isCurrent
                    ? accent.accent
                    : isDone
                      ? accent.wash
                      : surface.sunken,
                }}
              >
                <Text
                  variant="labelSm"
                  color={isCurrent ? onDark.primary : isDone ? accent.accentInk : ink.ink3}
                >
                  {m}
                </Text>
              </View>
            )
          })}
        </Row>

        {/* ── THE WARMING CARD — the product's core feedback signal ── */}
        <View
          accessibilityLabel={`${MODE_CUE[mode]}. ${phrase.es}. ${auto} percent automatic.`}
          style={{
            borderRadius: radius['2xl'],
            padding: 26,
            minHeight: 200,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space['2'],
            // The gradient bands render as their base colour; a real gradient lands
            // with Skia. The COLOUR PROGRESSION is the information, and it's here.
            backgroundColor: bandStyle.bg.startsWith('linear-gradient')
              ? (/#[0-9a-f]{6}/i.exec(bandStyle.bg)?.[0] ?? surface.card)
              : bandStyle.bg,
          }}
        >
          <Row gap={6}>
            <Text variant="caption">{MODE_ICON[mode]}</Text>
            <Text variant="labelSm" color={bandStyle.text}>
              {MODE_CUE[mode]}
            </Text>
          </Row>

          {/* Prompt content is mode-dependent: full → cloze → meaning → nothing. */}
          {(mode === 'echo' || mode === 'chorus' || mode === 'speed') && (
            <>
              <Text variant="title1" color={bandStyle.text} align="center" lang="es">
                {phrase.es}
              </Text>
              <Text variant="caption" color={bandStyle.text} align="center">
                {phrase.en}
              </Text>
            </>
          )}
          {mode === 'cloze' && (
            <>
              <Text variant="title1" color={bandStyle.text} align="center" lang="es">
                {cloze(phrase.es)}
              </Text>
              <Text variant="caption" color={bandStyle.text} align="center">
                {phrase.en}
              </Text>
            </>
          )}
          {mode === 'call' && (
            <>
              <Text variant="labelSm" color={bandStyle.text}>
                say the Spanish for
              </Text>
              <Text variant="title2" color={bandStyle.text} align="center">
                {phrase.en}
              </Text>
            </>
          )}
          {mode === 'cold' && (
            <>
              <Text style={{ fontSize: 32 }}>❄️</Text>
              <Text variant="caption" color={bandStyle.text} align="center">
                from memory
              </Text>
            </>
          )}
        </View>

        {/* ── Automaticity + falling effort ── */}
        <Card>
          <Row justify="space-between" style={{ marginBottom: space['2'] }}>
            <Text variant="labelSm" color={ink.ink}>
              Automaticity
            </Text>
            <Text variant="labelSm" color={accent.accentInk}>
              {auto}%
            </Text>
          </Row>
          {/* Named: this bar IS the product's core feedback signal, and accessibility.md
              requires the Refrain expose automaticity "as a progress bar with a
              percentage". Unnamed it announced as an anonymous progressbar. */}
          <ProgressBar value={auto / 100} height={9} track={surface.sunken} label="Automaticity" />

          {history.length > 0 && (
            <Row gap={space['2.5']} style={{ marginTop: space['3'] }}>
              {/* Effort bars: gaps for unmeasured reps, never interpolation. */}
              <Row gap={3} align="flex-end" style={{ height: 28 }}>
                {history.map((ms, i) => (
                  <View
                    key={i}
                    style={{
                      width: 7,
                      height: ms === null ? 3 : Math.max(6, Math.min(28, ms / 90)),
                      borderRadius: 2,
                      backgroundColor: ms === null ? line.default : line.stronger,
                    }}
                  />
                ))}
              </Row>
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  {/* null hides the read-out — never an estimate. */}
                  {formatLatency(lastLatency) !== null && (
                    <Text variant="caption" color={ink.ink}>
                      {formatLatency(lastLatency)}
                    </Text>
                  )}
                  <Text variant="labelSm" color={semantic.success.text}>
                    effort ↓
                  </Text>
                </Row>
                <Text variant="captionSm" color={ink.muted}>
                  {effortLabel(dayReps, auto)}
                </Text>
              </View>
            </Row>
          )}
        </Card>

        <Row justify="space-between">
          <Text variant="labelSm" color={ink.muted}>
            Rep {Math.min(dayReps, DEFAULT_REP_TARGET)} / {DEFAULT_REP_TARGET}
          </Text>
          <Dots count={DEFAULT_REP_TARGET} filled={dayReps} size={7} />
        </Row>

        {modelRateForMode(mode) !== null && (
          <Text variant="captionSm" color={ink.muted} align="center">
            Model plays at {modelRateForMode(mode)}× · audio lands with the native module
          </Text>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: space['4'],
          paddingBottom: insets.bottom + space['3'],
          backgroundColor: surface.app,
          borderTopWidth: 1,
          borderTopColor: line.default,
          gap: space['2.5'],
        }}
      >
        {locked ? (
          <>
            <Row
              gap={space['2.5']}
              style={{ backgroundColor: semantic.success.bg, borderRadius: radius.xl, padding: 12 }}
            >
              <Text style={{ fontSize: 20 }}>💎</Text>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={semantic.success.text}>
                  Locked in for today
                </Text>
                <Text variant="captionSm" color={semantic.successMeta.text}>
                  It comes out without thinking now.
                </Text>
              </View>
            </Row>
            <Button
              label={phraseNumber >= set.length ? 'Finish the set →' : 'Next phrase →'}
              onPress={nextPhrase}
            />
          </>
        ) : (
          <Pressable
            feedback="button"
            onPress={doRep}
            accessibilityLabel={micLabelForMode(mode)}
            accessibilityHint={MODE_CUE[mode]}
            style={{
              minHeight: 56,
              borderRadius: radius.lg,
              backgroundColor: accent.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title3" color={onDark.primary}>
              {micLabelForMode(mode)}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  )
}

/** Blank the most informative content word — never an article or preposition. */
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
  return words.map((w, i) => (i === best ? '___' : w)).join(' ')
}
