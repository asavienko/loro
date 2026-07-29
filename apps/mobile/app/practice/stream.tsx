/**
 * Adaptive stream — Loro.dc.html:600–677, logic 2516–2632.
 *
 * The one screen every persona uses. Live re-rating re-ranks the queue immediately,
 * and the toast explains the consequence — that's what teaches the model.
 */

import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { streamStats, type Difficulty } from '@loro/core'
import {
  Card,
  DarkCard,
  Dots,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  Stack,
  Text,
} from '../../src/ui/primitives'
import {
  accent,
  difficultyMeta,
  ink,
  line,
  onDark,
  radius,
  semantic,
  space,
  surface,
} from '../../src/ui/theme'
import { toView, useApp } from '../../src/store'

export default function Stream() {
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const recordPlay = useApp((s) => s.recordPlay)
  const [cursor, setCursor] = useState(0)

  // rank = plays + (hard −6 | easy +4) + (loved −3), ascending.
  const queue = useMemo(() => {
    const rank = (p: (typeof phrases)[number]): number =>
      p.plays +
      (p.difficulty === 'hard' ? -6 : p.difficulty === 'easy' ? 4 : 0) +
      (p.loved ? -3 : 0)
    return phrases
      .filter((p) => !p.learned)
      .slice()
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
      .map(toView)
  }, [phrases])

  const stats = streamStats(phrases)
  const current = queue[cursor % Math.max(1, queue.length)]
  const repeatTarget =
    current === undefined
      ? 3
      : current.difficulty === 'hard'
        ? 4
        : current.difficulty === 'easy'
          ? 2
          : 3

  if (queue.length === 0 || current === undefined) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space['2'],
            padding: space['5'],
          }}
        >
          <Text variant="title3" color={ink.ink} align="center">
            Your stream is empty
          </Text>
          <Text variant="caption" color={ink.muted} align="center">
            Add phrases to start listening
          </Text>
        </View>
      </Screen>
    )
  }

  const advance = (): void => {
    recordPlay(current.id)
    setCursor((c) => c + 1)
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          gap: space['3.5'],
          paddingBottom: insets.bottom + space['5'],
        }}
      >
        {/* ── Now playing ── */}
        <DarkCard>
          <Row justify="space-between">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                backgroundColor: onDark.surface,
                borderRadius: 20,
                paddingHorizontal: 11,
                paddingVertical: 5,
              }}
            >
              <Text variant="captionSm">{current.emoji}</Text>
              <Text variant="labelSm" color={onDark.secondary}>
                {current.theme}
              </Text>
            </View>
            <Text variant="labelSm" color={onDark.muted}>
              {cursor + 1} / {queue.length}
            </Text>
          </Row>

          <Stack gap={space['2']} style={{ marginTop: space['4'], alignItems: 'center' }}>
            <Text variant="title2" color={onDark.primary} align="center" lang="es">
              {current.es}
            </Text>
            <Text variant="caption" color={onDark.tertiary} align="center">
              {current.en}
            </Text>
          </Stack>

          <Row gap={6} justify="center" style={{ marginTop: space['3.5'] }}>
            <Text variant="labelSm" color={onDark.muted}>
              repeat
            </Text>
            <Dots count={repeatTarget} filled={0} />
          </Row>

          <View style={{ marginTop: space['3'] }}>
            <ProgressBar value={0.35} color={accent.accent} track={onDark.line} height={4} />
          </View>

          <Row justify="center" gap={space['5']} style={{ marginTop: space['4'] }}>
            <Pressable
              feedback="icon"
              accessibilityLabel="Previous"
              onPress={() => {
                setCursor((c) => Math.max(0, c - 1))
              }}
            >
              <Text variant="headline" color={onDark.muted}>
                ◄◄
              </Text>
            </Pressable>
            <Pressable
              feedback="button"
              accessibilityLabel="Next phrase"
              onPress={advance}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: accent.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="title2" color={onDark.primary}>
                ►
              </Text>
            </Pressable>
            <Pressable feedback="icon" accessibilityLabel="Skip" onPress={advance}>
              <Text variant="headline" color={onDark.muted}>
                ►►
              </Text>
            </Pressable>
          </Row>
        </DarkCard>

        {/* ── Live re-rating ── */}
        <Stack gap={space['2']}>
          <Row gap={7}>
            <Text variant="labelSm" color={ink.muted}>
              How&apos;s this one?
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable
              feedback="smallButton"
              accessibilityLabel={current.loved ? 'Remove from loved' : 'Love this phrase'}
              onPress={() => {
                toggleLoved(current.id)
              }}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: current.loved ? accent.accent : line.strong,
                backgroundColor: current.loved ? 'rgba(191,87,34,0.07)' : surface.card,
              }}
            >
              <Text variant="labelSm" color={current.loved ? accent.accentInk : ink.ink3}>
                {current.loved ? '♥ Loved' : '♡ Love'}
              </Text>
            </Pressable>
            <Pressable
              feedback="smallButton"
              accessibilityLabel="Mark learned"
              onPress={() => {
                markLearned(current.id, true)
              }}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: line.strong,
                backgroundColor: surface.card,
              }}
            >
              <Text variant="labelSm" color={semantic.success.text}>
                ✓ Learned
              </Text>
            </Pressable>
          </Row>

          <Row
            gap={3}
            style={{ backgroundColor: surface.sunken2, borderRadius: radius.lg, padding: 3 }}
          >
            {(['easy', 'med', 'hard'] as Difficulty[]).map((d) => {
              const active = current.difficulty === d
              return (
                <Pressable
                  key={d}
                  feedback="row"
                  accessibilityRole="radio"
                  accessibilityLabel={difficultyMeta[d].label}
                  onPress={() => {
                    setDifficulty(current.id, d)
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: active ? surface.card : 'transparent',
                  }}
                >
                  <Text variant="captionSm" color={active ? difficultyMeta[d].color : ink.muted}>
                    {difficultyMeta[d].label}
                  </Text>
                </Pressable>
              )
            })}
          </Row>
        </Stack>

        {/* ── Up next ── */}
        <Row justify="space-between" align="center">
          <Text variant="caption" color={ink.ink}>
            Up next
          </Text>
          <Row gap={5}>
            <Pill label={`♥ ${stats.loved}`} color={accent.accentInk} background={accent.wash} />
            <Pill
              label={`Difficult ${stats.hard}`}
              color={semantic.danger.text}
              background={semantic.danger.bg}
            />
            <Pill
              label={`Learned ${stats.learned}`}
              color={semantic.success.text}
              background={semantic.success.bg}
            />
          </Row>
        </Row>

        <Stack gap={space['2']}>
          {queue.slice(cursor + 1, cursor + 8).map((p) => (
            <Pressable
              key={p.id}
              feedback="row"
              accessibilityLabel={`${p.es}. ${p.en}. ${difficultyMeta[p.difficulty].label}.`}
              accessibilityHint="Opens phrase details"
              onPress={() => {
                router.push(`/phrase/${p.id}`)
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: surface.card,
                borderWidth: 1,
                borderColor: line.default,
                borderRadius: radius.lg,
                padding: 11,
              }}
            >
              <Text style={{ fontSize: 16 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={ink.ink} numberOfLines={1} lang="es">
                  {p.es}
                </Text>
                <Text variant="captionSm" color={ink.muted} numberOfLines={1}>
                  {p.en}
                </Text>
              </View>
              <Pill
                label={difficultyMeta[p.difficulty].label}
                color={difficultyMeta[p.difficulty].color}
                background={difficultyMeta[p.difficulty].bg}
              />
            </Pressable>
          ))}
        </Stack>

        <Card>
          <Text variant="captionSm" color={ink.muted} align="center">
            Audio playback arrives with the native audio module — see ADR-0007. The queue, the
            repeat counts, and the live re-ranking are real.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  )
}

function Pill({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.sm,
        backgroundColor: background,
      }}
    >
      <Text variant="labelSm" color={color}>
        {label}
      </Text>
    </View>
  )
}
