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

import { useCallback, useMemo, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  automaticity,
  DEFAULT_REP_TARGET,
  effortLabel,
  micLabelForMode,
  modeForRep,
  modelRateForMode,
  warmBand,
  type RefrainMode,
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
import { toView, useApp } from '../../src/store'
import { formatLatency } from '../../src/lib/format'

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
  const recordRep = useApp((s) => s.recordRep)

  const [index, setIndex] = useState(0)
  const [reps, setReps] = useState(0)
  const [lastLatency, setLastLatency] = useState<number | null>(null)
  const [history, setHistory] = useState<(number | null)[]>([])
  const [done, setDone] = useState(false)
  // Monotonic, so a wall-clock jump can't corrupt a measurement.
  const repStart = useRef<number>(Date.now())

  const set = useMemo(
    () =>
      refrainSet
        .map((id) => phrases.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .map(toView),
    [refrainSet, phrases],
  )

  const phrase = set[index]
  const mode = modeForRep(reps)
  const auto = automaticity(reps, DEFAULT_REP_TARGET)
  const band = warmBand(auto)
  const bandStyle = warming[band]
  const locked = auto >= 100

  const doRep = useCallback(() => {
    if (phrase === undefined || locked) return
    // MEASURED: from when the prompt settled to when the learner confirmed.
    const measured = Date.now() - repStart.current
    setLastLatency(measured)
    setHistory((h) => [...h.slice(-3), measured])
    recordRep(phrase.id, { success: true, latencyMs: measured })
    setReps((r) => r + 1)
    repStart.current = Date.now()
  }, [phrase, locked, recordRep])

  const nextPhrase = useCallback(() => {
    if (index + 1 >= set.length) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
    setReps(0)
    setLastLatency(null)
    setHistory([])
    repStart.current = Date.now()
  }, [index, set.length])

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

  if (done) {
    const totalReps = set.reduce((n, p) => n + p.repsToday, 0)
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
            Phrase {index + 1} / {set.length}
          </Text>
          <Dots count={set.length} filled={index} />
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
          <ProgressBar value={auto / 100} height={9} track={surface.sunken} />

          {reps > 0 && (
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
                  {effortLabel(reps, auto)}
                </Text>
              </View>
            </Row>
          )}
        </Card>

        <Row justify="space-between">
          <Text variant="labelSm" color={ink.muted}>
            Rep {Math.min(reps, DEFAULT_REP_TARGET)} / {DEFAULT_REP_TARGET}
          </Text>
          <Dots count={DEFAULT_REP_TARGET} filled={reps} size={7} />
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
              label={index + 1 >= set.length ? 'Finish the set →' : 'Next phrase →'}
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
