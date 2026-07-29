/**
 * Progress — Loro.dc.html:1787–1876, logic 2815–2871.
 *
 * The connective thread closing its loop: "What's tricky in your stream" rolls up
 * the learner's OWN tags, and tapping a row drills exactly those phrases.
 *
 * Nothing on this screen shames a missed day.
 */

import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { masteryBucket, streak as streakOf, type Tag } from '@loro/core'
import {
  Card,
  ChartSummary,
  DarkCard,
  Pressable,
  Row,
  Screen,
  SectionLabel,
  Stack,
  StatTile,
  Text,
} from '../src/ui/primitives'
import {
  accent,
  ink,
  line,
  masteryMeta,
  onDark,
  radius,
  semantic,
  space,
  surface,
  tagMeta,
} from '../src/ui/theme'
import { useApp } from '../src/store'
import { deviceClock, recentLocalDays } from '../src/lib/clock'

export default function Progress() {
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const practiceDays = useApp((s) => s.practiceDays)
  const showToast = useApp((s) => s.showToast)

  /**
   * Derived from the practice history, never stored. The same function `core-rs` exposes
   * to the widget, so the two show the same number (ADR-0002).
   */
  const streak = useMemo(() => streakOf(practiceDays, deviceClock.streakDay()), [practiceDays])

  const week = useMemo(() => {
    const practised = new Set(practiceDays)
    return recentLocalDays(7).map((d) => ({ ...d, practised: practised.has(d.day) }))
  }, [practiceDays])

  const weekSummary = useMemo(() => {
    const count = week.filter((d) => d.practised).length
    // Stated as what happened, with no comparison to what could have happened.
    return `Last seven days: practised on ${count} of them.`
  }, [week])

  const mastery = useMemo(() => {
    const counts: Record<string, number> = { new: 0, learning: 0, strong: 0, mastered: 0 }
    for (const p of phrases) counts[masteryBucket(p)] = (counts[masteryBucket(p)] ?? 0) + 1
    return masteryMeta.map((m) => ({ ...m, count: counts[m.key] ?? 0 }))
  }, [phrases])

  const total = Math.max(1, phrases.length)

  const tricky = useMemo(() => {
    const rows = (Object.keys(tagMeta) as Tag[])
      .map((t) => ({
        tag: t,
        ...tagMeta[t],
        count: phrases.filter((p) => p.tags.includes(t)).length,
      }))
      .filter((r) => r.count > 0)
    const max = Math.max(1, ...rows.map((r) => r.count))
    return rows.map((r) => ({ ...r, pct: r.count / max }))
  }, [phrases])

  const totalReps = phrases.reduce((n, p) => n + p.reps, 0)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          paddingBottom: insets.bottom + space['5'],
          gap: space['4'],
        }}
      >
        {/* ── Streak: warm and central, never punitive ── */}
        <DarkCard>
          <Row justify="space-between" align="flex-end">
            <View>
              <Text variant="labelSm" color={onDark.muted}>
                Current streak
              </Text>
              <Row gap={8} align="baseline" style={{ marginTop: 4 }}>
                <Text variant="hero" color={onDark.primary}>
                  {/* No streak yet reads as an absence, not a zero. Nothing here
                      apologises for a day that has not happened. */}
                  {streak === 0 ? '—' : streak}
                </Text>
                <Text variant="body" color={onDark.tertiary}>
                  {streak === 0 ? 'start today' : `${streak === 1 ? 'day' : 'days'} 🔥`}
                </Text>
              </Row>
            </View>
          </Row>
          {/* The last seven REAL days, filled from the practice history. This used to be
              `i < streak`: a bar chart pretending to be a calendar, which drew a
              seven-day streak for a learner who had practised once. */}
          {/* One accessible group: seven separate cells would be read as seven
              meaningless letters. */}
          <View accessible accessibilityLabel={weekSummary} style={{ marginTop: space['4'] }}>
            <Row gap={6}>
              {week.map((d) => (
                <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: '100%',
                      height: 30,
                      borderRadius: radius.sm,
                      // An unpractised day is neutral: no red, no dash, no penalty.
                      backgroundColor: d.practised ? accent.accent : onDark.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="captionSm">{d.practised ? '🔥' : ''}</Text>
                  </View>
                  <Text variant="labelSm" color={onDark.muted}>
                    {d.initial}
                  </Text>
                </View>
              ))}
            </Row>
          </View>
        </DarkCard>

        <Row gap={9}>
          <StatTile value={String(phrases.length)} label="phrases in stream" />
          <StatTile value={String(totalReps)} label="reps done" />
          <StatTile value={String(mastery[3]?.count ?? 0)} label="mastered" />
        </Row>

        {/* ── Phrase mastery ── */}
        <Card>
          <Row justify="space-between" align="baseline" style={{ marginBottom: space['3'] }}>
            <Text variant="caption" color={ink.ink}>
              Phrase mastery
            </Text>
            <Text variant="captionSm" color={ink.muted}>
              {phrases.length} total
            </Text>
          </Row>

          <Row
            gap={0}
            style={{
              height: 12,
              borderRadius: radius.sm,
              overflow: 'hidden',
              backgroundColor: surface.sunken,
            }}
          >
            {mastery.map((m) =>
              m.count > 0 ? (
                <View key={m.key} style={{ flex: m.count / total, backgroundColor: m.color }} />
              ) : null,
            )}
          </Row>

          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: space['3.5'] }}
          >
            {mastery.map((m) => (
              <Row key={m.key} gap={7}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: m.color }} />
                <Text variant="captionSm" color={ink.ink4}>
                  {m.label}
                </Text>
                <Text variant="captionSm" color={ink.ink}>
                  {m.count}
                </Text>
              </Row>
            ))}
          </View>

          {/* Every chart carries a visible summary — checked in CI. */}
          <ChartSummary>
            {mastery.map((m) => `${m.count} ${m.label.toLowerCase()}`).join(', ')}.
          </ChartSummary>
        </Card>

        {/* ── The thread closing its loop ── */}
        <Stack gap={space['2.5']}>
          <SectionLabel>What&apos;s tricky in your stream</SectionLabel>

          {tricky.length === 0 ? (
            <Card>
              <Text variant="caption" color={ink.muted}>
                Nothing tagged yet. Tag a phrase with what&apos;s hard about it and it shows up here
                — and steers what you practise.
              </Text>
            </Card>
          ) : (
            tricky.map((r) => (
              <Pressable
                key={r.tag}
                feedback="row"
                accessibilityLabel={`${r.label}, ${r.count} phrases`}
                accessibilityHint="Drills exactly these phrases"
                onPress={() => {
                  showToast(`Drilling ${r.count} “${r.label.toLowerCase()}” phrases`)
                  router.push('/practice/refrain')
                }}
                style={{
                  backgroundColor: surface.card,
                  borderWidth: 1,
                  borderColor: line.default,
                  borderRadius: radius.lg,
                  padding: 13,
                }}
              >
                <Row gap={9} style={{ marginBottom: 8 }}>
                  <View
                    style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: r.color }}
                  />
                  <Text variant="caption" color={ink.ink} style={{ flex: 1 }}>
                    {r.label}
                  </Text>
                  <Text variant="caption" color={r.color}>
                    {r.count}
                  </Text>
                  <Text variant="body" color={ink.muted2}>
                    ›
                  </Text>
                </Row>
                <View
                  style={{
                    height: 7,
                    borderRadius: 8,
                    backgroundColor: surface.sunken,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{ width: `${r.pct * 100}%`, height: '100%', backgroundColor: r.color }}
                  />
                </View>
              </Pressable>
            ))
          )}
        </Stack>

        {/* ── Milestones ── */}
        <Stack gap={space['2.5']}>
          <SectionLabel>Milestones</SectionLabel>
          {[
            {
              emoji: '🌱',
              title: 'First 10 phrases',
              sub: `${phrases.length} collected`,
              done: phrases.length >= 10,
            },
            {
              emoji: '💬',
              title: 'First tagged phrase',
              sub: 'The thread begins',
              done: phrases.some((p) => p.tags.length > 0),
            },
            {
              emoji: '🔥',
              title: 'First locked in',
              sub: 'Six reps in one day',
              done: phrases.some((p) => p.automaticity >= 100),
            },
            {
              emoji: '🏆',
              title: '25 mastered',
              sub: `${mastery[3]?.count ?? 0} of 25`,
              done: (mastery[3]?.count ?? 0) >= 25,
            },
          ].map((m) => (
            <Row
              key={m.title}
              gap={12}
              style={{
                backgroundColor: m.done ? surface.card : surface.sunken,
                borderWidth: 1,
                borderColor: line.default,
                borderRadius: radius.xl,
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.lg,
                  backgroundColor: m.done ? semantic.success.bg : line.default,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: m.done ? 1 : 0.55,
                }}
              >
                <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" color={m.done ? ink.ink : ink.ink3}>
                  {m.title}
                </Text>
                <Text variant="captionSm" color={ink.muted}>
                  {m.sub}
                </Text>
              </View>
              {m.done && (
                <Text variant="headline" color={semantic.successAlt.text}>
                  ✓
                </Text>
              )}
            </Row>
          ))}
        </Stack>
      </ScrollView>
    </Screen>
  )
}
