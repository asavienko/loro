/**
 * Onboarding — Loro.dc.html:128–212, logic 2068–2174.
 *
 * Six steps: welcome → goal → level → time → packs → ready.
 * Seeds a REAL stream from the chosen packs, so the learner never lands in an empty app.
 */

import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, EmojiTile, Pressable, Row, Screen, Stack, Text } from '../src/ui/primitives'
import { accent, ink, line, onDark, radius, space, surface } from '../src/ui/theme'
import { packs, useApp } from '../src/store'

type StepKind = 'welcome' | 'choice' | 'ready'
interface Option {
  val: string
  emoji: string
  label: string
  sub: string
}
interface Step {
  kind: StepKind
  key?: 'goal' | 'level' | 'mins' | 'packs'
  multi?: boolean
  question?: string
  helper?: string
  options?: Option[]
}

const STEPS: Step[] = [
  { kind: 'welcome' },
  {
    kind: 'choice',
    key: 'goal',
    question: 'What brings you to Spanish?',
    helper: "We'll lead with the phrases that fit.",
    options: [
      { val: 'trip', emoji: '🧳', label: 'A trip coming up', sub: 'Survival & travel first' },
      { val: 'convo', emoji: '💬', label: 'Real conversations', sub: 'Small talk & everyday' },
      { val: 'move', emoji: '🌍', label: 'Moving abroad', sub: 'The full picture, fast' },
      { val: 'curious', emoji: '🪶', label: 'Just curious', sub: 'A relaxed mix' },
    ],
  },
  {
    kind: 'choice',
    key: 'level',
    question: 'How much Spanish do you have?',
    helper: 'Sets how long and tricky your first phrases are.',
    options: [
      { val: 'beg', emoji: '🌱', label: 'Starting out', sub: 'Little to none' },
      { val: 'some', emoji: '🌿', label: 'Some basics', sub: 'I know a few things' },
      { val: 'conf', emoji: '🌳', label: 'Fairly confident', sub: 'I can hold a chat' },
    ],
  },
  {
    kind: 'choice',
    key: 'mins',
    question: 'How much time per day?',
    helper: 'Your daily stream is built to fit.',
    options: [
      { val: '5', emoji: '⚡', label: '5 minutes', sub: 'Light & steady' },
      { val: '10', emoji: '🔥', label: '10 minutes', sub: 'A good rhythm' },
      { val: '20', emoji: '🚀', label: '20 minutes', sub: 'Serious progress' },
    ],
  },
  {
    kind: 'choice',
    key: 'packs',
    multi: true,
    question: 'Pick a few starter packs',
    helper: 'Choose at least one — these seed your stream now.',
    options: packs
      .filter((p) => p.onboarding)
      .map((p) => ({
        val: p.id,
        emoji: p.emoji,
        label: p.label,
        sub: `${p.phrases.length} phrases`,
      })),
  },
  { kind: 'ready' },
]

export default function Onboarding() {
  const insets = useSafeAreaInsets()
  const complete = useApp((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({ packs: [] })

  const current = STEPS[step]
  if (current === undefined) return null

  const value = current.key === undefined ? undefined : answers[current.key]
  const canContinue =
    current.kind !== 'choice' ||
    (current.multi === true ? Array.isArray(value) && value.length > 0 : typeof value === 'string')

  const seedCount = (answers['packs'] as string[]).reduce(
    (n, id) => n + (packs.find((p) => p.id === id)?.phrases.length ?? 0),
    0,
  )

  const choose = (key: string, val: string, multi: boolean): void => {
    setAnswers((a) => {
      if (!multi) return { ...a, [key]: val }
      const cur = (a[key] as string[] | undefined) ?? []
      return { ...a, [key]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] }
    })
  }

  const next = (): void => {
    if (current.kind === 'ready') {
      const mins = Number(answers['mins'] ?? 10)
      complete({
        goal: String(answers['goal'] ?? 'curious'),
        dailyMinutes: mins === 5 ? 5 : mins === 20 ? 20 : 10,
        packIds: answers['packs'] as string[],
      })
      router.replace('/')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space['2'], paddingHorizontal: space['5'] }}>
        <Row gap={space['1.5']}>
          {step > 0 && (
            <Pressable
              feedback="icon"
              accessibilityLabel="Back"
              onPress={() => {
                setStep((s) => Math.max(0, s - 1))
              }}
              style={{ paddingRight: space['2'] }}
            >
              <Text variant="title3" color={ink.ink3}>
                ‹
              </Text>
            </Pressable>
          )}
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 2,
                backgroundColor: i <= step ? accent.accent : line.default,
              }}
            />
          ))}
        </Row>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space['5'], gap: space['4'], flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {current.kind === 'welcome' && (
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['3'] }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: radius['3xl'],
                backgroundColor: accent.wash,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="display" style={{ fontSize: 50, lineHeight: 58 }}>
                🦜
              </Text>
            </View>
            <Text variant="title2" color={accent.accentInk} align="center" lang="es">
              ¡Hola! I&apos;m Loro
            </Text>
            <Text variant="title1" color={ink.ink} align="center">
              Learn Spanish{'\n'}by the phrase
            </Text>
            <Text variant="caption" color={ink.ink3} align="center">
              Forget grammar drills. You&apos;ll collect phrases that matter to you and learn them
              by listening and repeating — like a parrot, until they&apos;re yours.
            </Text>
          </View>
        )}

        {current.kind === 'choice' && (
          <Stack gap={space['3']}>
            <Text variant="title2" color={ink.ink}>
              {current.question}
            </Text>
            <Text variant="caption" color={ink.muted}>
              {current.helper}
            </Text>
            <Stack gap={9}>
              {(current.options ?? []).map((o) => {
                const active =
                  current.multi === true
                    ? Array.isArray(value) && value.includes(o.val)
                    : value === o.val
                return (
                  <Pressable
                    key={o.val}
                    feedback="row"
                    accessibilityRole={current.multi === true ? 'checkbox' : 'radio'}
                    accessibilityLabel={`${o.label}. ${o.sub}`}
                    selected={active}
                    onPress={() => {
                      choose(current.key ?? '', o.val, current.multi === true)
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 13,
                      backgroundColor: active ? accent.tint : surface.card,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? accent.accent : line.strong,
                      borderRadius: radius.lg,
                      padding: 14,
                    }}
                  >
                    <EmojiTile emoji={o.emoji} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" color={ink.ink}>
                        {o.label}
                      </Text>
                      <Text variant="captionSm" color={ink.muted}>
                        {o.sub}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: active ? 0 : 2,
                        borderColor: line.stronger,
                        backgroundColor: active ? accent.accent : surface.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active && (
                        <Text variant="captionSm" color={onDark.primary}>
                          {current.multi === true ? '✓' : '●'}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                )
              })}
            </Stack>
          </Stack>
        )}

        {current.kind === 'ready' && (
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['3'] }}
          >
            <Text variant="display" style={{ fontSize: 44, lineHeight: 52 }}>
              ✅
            </Text>
            <Text variant="title2" color={accent.accentInk}>
              You&apos;re all set
            </Text>
            <Text variant="title2" color={ink.ink} align="center">
              {seedCount} phrases are{'\n'}in your stream
            </Text>
            <Text variant="caption" color={ink.ink3} align="center">
              Your first {String(answers['mins'] ?? 10)}-minute session is ready whenever you are.
            </Text>
            <Card style={{ width: '100%', marginTop: space['3'] }}>
              <Stack gap={space['2']}>
                <Row justify="space-between">
                  <Text variant="labelSm" color={ink.muted}>
                    Goal
                  </Text>
                  <Text variant="captionSm" color={ink.ink}>
                    {String(answers['goal'] ?? '—')}
                  </Text>
                </Row>
                <Row justify="space-between">
                  <Text variant="labelSm" color={ink.muted}>
                    Daily
                  </Text>
                  <Text variant="captionSm" color={ink.ink}>
                    {String(answers['mins'] ?? 10)} min
                  </Text>
                </Row>
                <Row justify="space-between">
                  <Text variant="labelSm" color={ink.muted}>
                    Packs
                  </Text>
                  <Text variant="captionSm" color={ink.ink}>
                    {(answers['packs'] as string[]).length} selected
                  </Text>
                </Row>
              </Stack>
            </Card>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: space['5'], paddingBottom: insets.bottom + space['4'] }}>
        <Button
          label={
            current.kind === 'welcome'
              ? "Let's go →"
              : current.kind === 'ready'
                ? 'Start learning 🎧'
                : 'Continue'
          }
          onPress={next}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  )
}
