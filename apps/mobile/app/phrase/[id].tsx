/**
 * Phrase detail — Loro.dc.html:436–581, logic 2435–2514.
 *
 * ONE source of truth per phrase. Every list in the app opens this screen, and every
 * rating control here writes to the same row the stream and Progress read.
 */

import { ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { masteryBucket, type Difficulty, type Tag } from '@loro/core'
import {
  Button,
  Card,
  Divider,
  Pill,
  Pressable,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../../src/ui/primitives'
import {
  accent,
  difficultyMeta,
  ink,
  line,
  radius,
  semantic,
  space,
  surface,
  tagMeta,
} from '../../src/ui/theme'
import { toView, useApp } from '../../src/store'

export default function PhraseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const phrases = useApp((s) => s.phrases)
  const setDifficulty = useApp((s) => s.setDifficulty)
  const toggleTag = useApp((s) => s.toggleTag)
  const toggleLoved = useApp((s) => s.toggleLoved)
  const markLearned = useApp((s) => s.markLearned)
  const removePhrase = useApp((s) => s.removePhrase)
  const setNote = useApp((s) => s.setNote)

  const state = phrases.find((p) => p.id === id)
  if (state === undefined) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['2'] }}>
          <Text variant="title3" color={ink.ink}>
            No phrase selected
          </Text>
          <Text variant="caption" color={ink.muted}>
            Add or tap a phrase to view it
          </Text>
        </View>
      </Screen>
    )
  }

  const p = toView(state)
  const cat = p.catalog
  const bucket = masteryBucket(state)

  const hooks = [
    'Say it out loud 3× now — your mouth remembers what your eyes forget.',
    `Tie “${p.es.split(' ').slice(0, 2).join(' ')}…” to the exact moment you would use it.`,
    'Picture the scene: who you are talking to, and what happens next.',
  ]

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          paddingBottom: insets.bottom + 110,
          gap: space['4'],
        }}
      >
        <Row justify="space-between">
          <Pill label={p.theme} />
          <Pressable
            feedback="icon"
            accessibilityLabel={state.loved ? 'Remove from loved' : 'Mark as loved'}
            onPress={() => {
              toggleLoved(p.id)
            }}
          >
            <Text variant="headline" color={state.loved ? accent.accentInk : ink.muted2}>
              {state.loved ? '♥' : '♡'}
            </Text>
          </Pressable>
        </Row>

        {/* ── Hero ── */}
        <Stack gap={space['2']} style={{ alignItems: 'center' }}>
          <Text variant="title1" color={ink.ink} align="center" lang="es">
            {p.es}
          </Text>
          <Text variant="body" color={ink.ink3} align="center">
            {p.en}
          </Text>
          {cat?.resp !== undefined && (
            <Text
              variant="caption"
              color={ink.muted}
              align="center"
              style={{ fontStyle: 'italic' }}
            >
              {cat.resp}
            </Text>
          )}
        </Stack>

        {/* ── Word by word ── */}
        {cat?.words !== undefined && cat.words.length > 0 && (
          <Stack gap={9}>
            <SectionLabel>Word by word</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cat.words.map((w, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: surface.card,
                    borderWidth: 1,
                    borderColor: line.default,
                    borderRadius: radius.lg,
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="body" color={ink.ink} lang="es">
                    {w.es}
                  </Text>
                  <Text variant="labelSm" color={ink.muted}>
                    {w.gloss}
                  </Text>
                </View>
              ))}
            </View>
          </Stack>
        )}

        {/* ── Difficulty: the same editor as the add sheet ── */}
        <Stack gap={9}>
          <SectionLabel>How hard is it for you?</SectionLabel>
          <Row gap={8}>
            {(['easy', 'med', 'hard'] as Difficulty[]).map((d) => {
              const meta = difficultyMeta[d]
              const active = state.difficulty === d
              return (
                <Pressable
                  key={d}
                  feedback="row"
                  accessibilityRole="radio"
                  accessibilityLabel={meta.label}
                  selected={active}
                  onPress={() => {
                    setDifficulty(p.id, d)
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderRadius: radius.lg,
                    backgroundColor: active ? meta.bg : surface.card,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? meta.border : line.strong,
                  }}
                >
                  <Text variant="labelSm" color={active ? meta.color : ink.ink3}>
                    {meta.label}
                  </Text>
                </Pressable>
              )
            })}
          </Row>
        </Stack>

        {/* ── Tags ── */}
        <Stack gap={9}>
          <Row gap={7} align="baseline">
            <SectionLabel>What&apos;s tricky</SectionLabel>
            <Text variant="captionSm" color={ink.muted}>
              tap to toggle
            </Text>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(tagMeta) as Tag[]).map((t) => {
              const active = state.tags.includes(t)
              return (
                <Pressable
                  key={t}
                  feedback="smallButton"
                  accessibilityRole="checkbox"
                  accessibilityLabel={tagMeta[t].label}
                  selected={active}
                  onPress={() => {
                    toggleTag(p.id, t)
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: radius.lg,
                    backgroundColor: active ? 'rgba(191,87,34,0.07)' : surface.card,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? accent.accent : line.strong,
                  }}
                >
                  <Text variant="captionSm" color={active ? accent.accentInk : ink.ink2}>
                    {tagMeta[t].label}
                    {active ? ' ✓' : ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Stack>

        {/* ── In context ── */}
        {cat?.example !== undefined && (
          <Stack gap={9}>
            <SectionLabel>In context</SectionLabel>
            <Card>
              <Text variant="bodySm" color={ink.ink} lang="es">
                {cat.example.es}
              </Text>
              <Text variant="captionSm" color={ink.muted} style={{ marginTop: 5 }}>
                {cat.example.en}
              </Text>
            </Card>
          </Stack>
        )}

        {/* ── Memory hook ── */}
        <Stack gap={9}>
          <Row gap={7} align="baseline">
            <SectionLabel>Memory hook</SectionLabel>
            <Text variant="captionSm" color={ink.muted}>
              helps it stick
            </Text>
          </Row>
          {state.note !== null && state.note.length > 0 ? (
            <Pressable
              feedback="row"
              accessibilityLabel={`Memory hook: ${state.note}. Tap to change.`}
              onPress={() => {
                setNote(p.id, '')
              }}
              style={{ backgroundColor: semantic.hook.bg, borderRadius: radius.lg, padding: 13 }}
            >
              <Row gap={10} align="flex-start">
                <Text style={{ fontSize: 16 }}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={semantic.hook.text}>
                    {state.note}
                  </Text>
                  <Text variant="labelSm" color={semantic.hookMeta.text} style={{ marginTop: 6 }}>
                    tap to change
                  </Text>
                </View>
              </Row>
            </Pressable>
          ) : (
            <Stack gap={7}>
              {(cat?.hint !== undefined ? [cat.hint, ...hooks] : hooks).map((h, i) => (
                <Pressable
                  key={i}
                  feedback="row"
                  accessibilityLabel={`Use hook: ${h}`}
                  onPress={() => {
                    setNote(p.id, h)
                  }}
                  style={{ backgroundColor: surface.card, borderRadius: radius.lg, padding: 12 }}
                >
                  <Text variant="captionSm" color={semantic.hook.text}>
                    {h}
                  </Text>
                </Pressable>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        {/* ── Status ── */}
        {/* `flexWrap` for the same reason as the stream's re-rating row: at a large font
            scale the button must drop to the next line, not off the screen. */}
        <Row
          justify="space-between"
          style={{
            backgroundColor: surface.sunken,
            borderRadius: radius.xl,
            padding: 13,
            flexWrap: 'wrap',
          }}
        >
          <View>
            <Text variant="caption" color={ink.ink}>
              {state.learned ? 'Learned' : 'Learning'}
            </Text>
            <Text variant="captionSm" color={ink.muted}>
              {state.reps} reps · {bucket}
            </Text>
          </View>
          <Pressable
            feedback="smallButton"
            accessibilityLabel={state.learned ? 'Mark as still learning' : 'Mark learned'}
            onPress={() => {
              markLearned(p.id, !state.learned)
            }}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 8,
              borderRadius: radius.lg,
              backgroundColor: state.learned ? semantic.success.bg : surface.card,
              borderWidth: state.learned ? 0 : 1,
              borderColor: line.strong,
            }}
          >
            <Text variant="labelSm" color={state.learned ? semantic.success.text : ink.ink2}>
              {state.learned ? '✓ Learned' : 'Mark learned'}
            </Text>
          </Pressable>
        </Row>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: space['2.5'],
          padding: space['4'],
          paddingBottom: insets.bottom + space['3'],
          backgroundColor: surface.app,
          borderTopWidth: 1,
          borderTopColor: line.default,
        }}
      >
        <Button
          label="Remove"
          variant="destructive"
          onPress={() => {
            removePhrase(p.id)
            router.back()
          }}
        />
        <View style={{ flex: 1 }}>
          <Button
            label="Practice now →"
            onPress={() => {
              router.push('/practice/refrain')
            }}
          />
        </View>
      </View>
    </Screen>
  )
}
