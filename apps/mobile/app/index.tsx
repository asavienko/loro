/**
 * Today — the ritual home. Loro.dc.html:1316–1391.
 *
 * A CLOSED, finite set you can see in full and finish. No queue, no hidden
 * algorithm: you always see today.
 */

import { useEffect } from 'react'
import { ScrollView, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEFAULT_REP_TARGET, streak as streakOf } from '@loro/core'
import {
  Button,
  Card,
  Divider,
  Pressable,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Stack,
  StatTile,
  Text,
} from '../src/ui/primitives'
import { accent, ink, line, radius, scale, space, surface } from '../src/ui/theme'
import { toView, useApp } from '../src/store'
import { deviceClock, localWeekdayLabel } from '../src/lib/clock'

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

  const set = refrainSet
    .map((id) => phrases.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map(toView)

  const lockedIn = set.filter((p) => p.automaticity >= 100).length
  const totalReps = set.reduce((n, p) => n + p.repsToday, 0)
  const graduated = phrases.filter((p) => p.graduatedAt !== null).length

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          paddingTop: insets.top + space['3'],
          paddingBottom: insets.bottom + 96,
          gap: space['4'],
        }}
      >
        <Row justify="space-between" align="flex-end">
          <View>
            <Text variant="labelSm" color={ink.muted}>
              {localWeekdayLabel()} · the daily refrain
            </Text>
            <Text variant="title3" color={ink.ink}>
              Today
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: accent.wash,
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Text variant="caption">🔥</Text>
            <Text variant="bodySm" color={accent.accentInk}>
              {/* A learner on day zero sees an invitation, not a zero. */}
              {streak === 0 ? '—' : streak}
            </Text>
          </View>
        </Row>

        {/* ── Today's set: closed, finite, finishable ── */}
        <Card>
          <Row justify="space-between" align="baseline" style={{ marginBottom: space['3'] }}>
            <Text variant="caption" color={ink.ink}>
              Today&apos;s {set.length === 0 ? 'set' : set.length}
            </Text>
            <Text variant="labelSm" color={ink.muted}>
              {lockedIn} of {set.length} locked in
            </Text>
          </Row>

          {set.length === 0 ? (
            <Stack gap={space['2']}>
              <Text variant="caption" color={ink.muted}>
                Nothing in rotation yet. Add a few phrases and today&apos;s set builds itself.
              </Text>
              <Button
                label="Add phrases"
                variant="secondary"
                onPress={() => {
                  router.push('/add')
                }}
              />
            </Stack>
          ) : (
            <Stack gap={space['2.5']}>
              {set.map((p) => (
                <Pressable
                  key={p.id}
                  feedback="row"
                  accessibilityLabel={`${p.es}. ${p.automaticity} percent automatic.`}
                  accessibilityHint="Opens phrase details"
                  onPress={() => {
                    router.push(`/phrase/${p.id}`)
                  }}
                >
                  <Row justify="space-between" style={{ marginBottom: 5 }}>
                    <Text
                      variant="caption"
                      color={ink.ink}
                      numberOfLines={1}
                      lang="es"
                      style={{ flex: 1 }}
                    >
                      {p.es}
                    </Text>
                    {p.automaticity >= 100 && (
                      <View
                        style={{
                          backgroundColor: accent.wash,
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Text variant="labelSm" color={accent.accentInk}>
                          Locked
                        </Text>
                      </View>
                    )}
                  </Row>
                  <ProgressBar
                    value={p.automaticity / 100}
                    color={p.automaticity >= 100 ? accent.accent : scale.ladder.bent}
                    track={surface.sunken}
                  />
                </Pressable>
              ))}
            </Stack>
          )}
        </Card>

        {/* ── The three waves ── */}
        <Stack gap={space['2']}>
          <SectionLabel>Today&apos;s three waves</SectionLabel>
          {[
            { label: 'Morning', sub: 'Meet & first reps', time: '8:00' },
            { label: 'Midday', sub: 'Re-rep, from memory', time: '1:00' },
            { label: 'Evening', sub: 'Cold + perform', time: '7:00' },
          ].map((w, i) => {
            const ready = i === 0 || lockedIn > 0
            return (
              <Row
                key={w.label}
                gap={11}
                style={{
                  backgroundColor: ready ? 'rgba(191,87,34,0.07)' : surface.card,
                  borderWidth: ready ? 1.5 : 1,
                  borderColor: ready ? accent.accent : line.default,
                  borderRadius: radius.xl,
                  padding: 11,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 1.5,
                    borderColor: ready ? accent.accent : ink.muted2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="labelSm" color={ready ? accent.accentInk : ink.muted2}>
                    {ready ? '●' : '○'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={ink.ink}>
                    {w.label}
                  </Text>
                  <Text variant="captionSm" color={ink.muted}>
                    {w.sub}
                  </Text>
                </View>
                <Text variant="labelSm" color={ink.muted}>
                  {w.time}
                </Text>
              </Row>
            )
          })}
        </Stack>

        <Row gap={9}>
          <StatTile value={String(totalReps)} label="reps today" />
          <StatTile value={String(phrases.length)} label="in your stream" />
          <StatTile value={String(graduated)} label="graduated" />
        </Row>

        <Divider />

        <Row gap={space['2.5']}>
          <View style={{ flex: 1 }}>
            <Button
              label="Stream"
              variant="secondary"
              onPress={() => {
                router.push('/practice/stream')
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Progress"
              variant="secondary"
              onPress={() => {
                router.push('/progress')
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Add"
              variant="secondary"
              onPress={() => {
                router.push('/add')
              }}
            />
          </View>
        </Row>
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
        }}
      >
        <Button
          label={set.length === 0 ? 'Add phrases to begin' : `Start the wave →`}
          disabled={set.length === 0}
          accessibilityHint={`${set.length} phrases, ${DEFAULT_REP_TARGET} reps each`}
          onPress={() => {
            router.push('/practice/refrain')
          }}
        />
      </View>
    </Screen>
  )
}
