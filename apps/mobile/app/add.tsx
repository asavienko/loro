/**
 * Add phrases — Loro.dc.html:222–427, logic 2176–2433.
 *
 * Discover (search + association + scenarios) and Browse (by theme). The tagging
 * sheet is where the connective thread starts: difficulty + "what's tricky", set at
 * add time, reshape everything downstream.
 */

import { useMemo, useState } from 'react'
import { Modal, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Difficulty, Tag } from '@loro/core'
import type { CatalogPhrase } from '@loro/content'
import {
  Button,
  Card,
  EmojiTile,
  Pressable,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import {
  accent,
  difficultyMeta,
  ink,
  line,
  onDark,
  radius,
  space,
  surface,
  tagMeta,
} from '../src/ui/theme'
import { catalogPhrases, scenarios, useApp } from '../src/store'

const THEMES = [
  // a11y-lang: English UI category labels. "Café" is the English loanword, and a
  // screen reader should read this list in the interface language, not Spanish.
  { name: 'Café', emoji: '☕' },
  { name: 'Dining', emoji: '🍽' },
  { name: 'Travel', emoji: '🚆' },
  { name: 'Directions', emoji: '🧭' },
  { name: 'Shopping', emoji: '🛍' },
  { name: 'Small talk', emoji: '🤝' },
  { name: 'Survival', emoji: '🆘' },
  { name: 'Hotel', emoji: '🏨' },
]

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Add() {
  const insets = useSafeAreaInsets()
  const owned = useApp((s) => s.phrases)
  const addPhrase = useApp((s) => s.addPhrase)

  const [mode, setMode] = useState<'discover' | 'browse'>('discover')
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState<string | null>(null)
  const [browseTheme, setBrowseTheme] = useState<string | null>(null)
  // The association anchor: after adding, suggestions become "more like that".
  const [anchorTheme, setAnchorTheme] = useState<string | null>(null)
  const [sheet, setSheet] = useState<CatalogPhrase | null>(null)
  const [draftDiff, setDraftDiff] = useState<Difficulty>('med')
  const [draftTags, setDraftTags] = useState<Tag[]>([])

  // Joined on the CATALOG id, not the row id. They happen to be equal today, but
  // they are different id spaces — a learner-authored phrase has a row id and no
  // catalog id — and `UserPhraseId`/`CatalogPhraseId` are branded so the join can't
  // drift silently. `Set<string>` because the catalog's own ids are unbranded.
  const ownedCatalogIds = useMemo(
    () => new Set<string>(owned.flatMap((p) => (p.phraseId === null ? [] : [p.phraseId]))),
    [owned],
  )
  const pool = useMemo(
    () => catalogPhrases.filter((p) => !ownedCatalogIds.has(p.id)),
    [ownedCatalogIds],
  )

  const suggestions = useMemo(() => {
    if (mode === 'browse' && browseTheme !== null) {
      return pool.filter((p) => p.theme === browseTheme)
    }
    const q = norm(query.trim())
    if (q.length >= 1) {
      return pool
        .filter(
          (p) => norm(p.es).includes(q) || norm(p.en).includes(q) || norm(p.theme).includes(q),
        )
        .slice(0, 8)
    }
    if (scenario !== null) {
      const sc = scenarios.find((s) => s.id === scenario)
      return (sc?.phrases ?? [])
        .map((id) => pool.find((p) => p.id === id))
        .filter((p): p is CatalogPhrase => p !== undefined)
    }
    if (anchorTheme !== null) {
      // Association: same-theme first, then everything else.
      const same = pool.filter((p) => p.theme === anchorTheme)
      const rest = pool.filter((p) => p.theme !== anchorTheme)
      return [...same, ...rest].slice(0, 6)
    }
    return pool.slice(0, 6)
  }, [mode, browseTheme, query, scenario, anchorTheme, pool])

  const contextLabel =
    query.trim().length > 0
      ? suggestions.length > 0
        ? `Matches for "${query.trim()}"`
        : 'No matches in the library'
      : scenario !== null
        ? `For: ${scenarios.find((s) => s.id === scenario)?.label ?? ''}`
        : anchorTheme !== null
          ? `More like ${anchorTheme}`
          : 'Popular starters'

  const confirmAdd = (): void => {
    if (sheet === null) return
    addPhrase(sheet.id, { difficulty: draftDiff, tags: draftTags, source: 'discover' })
    setAnchorTheme(sheet.theme)
    setSheet(null)
    setDraftDiff('med')
    setDraftTags([])
    setQuery('')
    setScenario(null)
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: space['4'], paddingTop: space['2'], gap: space['2.5'] }}>
        <Row justify="space-between">
          <Text variant="labelSm" color={ink.muted}>
            {owned.length} in stream
          </Text>
        </Row>

        <Row gap={6}>
          {(['discover', 'browse'] as const).map((m) => (
            <Pressable
              key={m}
              feedback="button"
              accessibilityLabel={m}
              onPress={() => {
                setMode(m)
                setBrowseTheme(null)
                setQuery('')
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 9,
                borderRadius: radius.lg,
                backgroundColor: mode === m ? surface.dark : surface.card,
                borderWidth: mode === m ? 0 : 1,
                borderColor: line.default,
              }}
            >
              <Text variant="labelSm" color={mode === m ? onDark.primary : ink.ink3}>
                {m}
              </Text>
            </Pressable>
          ))}
        </Row>

        {mode === 'discover' && (
          <>
            <View
              style={{
                backgroundColor: surface.card,
                borderWidth: 1.5,
                borderColor: query.length > 0 ? accent.accent : line.default,
                borderRadius: radius.xl,
                paddingHorizontal: 13,
              }}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type a phrase, or a topic…"
                placeholderTextColor={ink.muted2}
                accessibilityLabel="Search phrases"
                style={{ height: 46, fontSize: 14, fontWeight: '600', color: ink.ink }}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7 }}
            >
              <Text variant="labelSm" color={ink.muted} style={{ alignSelf: 'center' }}>
                Scenario
              </Text>
              {scenarios.map((sc) => {
                const active = scenario === sc.id
                return (
                  <Pressable
                    key={sc.id}
                    feedback="smallButton"
                    accessibilityLabel={sc.label}
                    onPress={() => {
                      setScenario(active ? null : sc.id)
                      setQuery('')
                      setAnchorTheme(null)
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: active ? accent.accent : surface.card,
                      borderWidth: active ? 0 : 1,
                      borderColor: line.default,
                      borderRadius: radius.lg,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text variant="captionSm">{sc.emoji}</Text>
                    <Text variant="captionSm" color={active ? onDark.primary : ink.ink2}>
                      {sc.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space['4'],
          paddingBottom: insets.bottom + space['5'],
          gap: space['2'],
        }}
      >
        {mode === 'browse' && browseTheme === null ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {THEMES.map((t) => {
              const count = pool.filter((p) => p.theme === t.name).length
              return (
                <Pressable
                  key={t.name}
                  feedback="row"
                  accessibilityLabel={`${t.name}, ${count} to add`}
                  onPress={() => {
                    setBrowseTheme(t.name)
                  }}
                  style={{
                    width: '48%',
                    backgroundColor: surface.card,
                    borderWidth: 1,
                    borderColor: line.default,
                    borderRadius: radius.lg,
                    padding: 14,
                  }}
                >
                  <EmojiTile emoji={t.emoji} size={40} />
                  <Text variant="bodySm" color={ink.ink} style={{ marginTop: 10 }}>
                    {t.name}
                  </Text>
                  <Text variant="labelSm" color={ink.muted}>
                    {count > 0 ? `${count} to add` : 'all added ✓'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : (
          <>
            <Row justify="space-between" align="center">
              {mode === 'browse' ? (
                <Pressable
                  feedback="smallButton"
                  accessibilityLabel="Back to themes"
                  onPress={() => {
                    setBrowseTheme(null)
                  }}
                  // A bare text button is 17px tall — 33 even with hitSlop, under the 44
                  // floor. Padding rather than `minHeight` so the label stays vertically
                  // centred in the row it shares with the section label.
                  style={{ paddingVertical: 8, paddingRight: space['2'] }}
                >
                  <Text variant="captionSm" color={ink.ink2}>
                    ‹ Themes
                  </Text>
                </Pressable>
              ) : (
                <SectionLabel>{contextLabel}</SectionLabel>
              )}
            </Row>

            {suggestions.length === 0 ? (
              <Card>
                <Text variant="caption" color={ink.muted} align="center">
                  Nothing more to suggest here.{'\n'}Try another theme, scenario, or search above.
                </Text>
              </Card>
            ) : (
              suggestions.map((p) => (
                <Pressable
                  key={p.id}
                  feedback="row"
                  accessibilityLabel={`${p.es}. ${p.en}`}
                  accessibilityHint="Opens the tagging sheet"
                  onPress={() => {
                    setSheet(p)
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: surface.card,
                    borderWidth: 1,
                    borderColor: line.default,
                    borderRadius: radius.lg,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 17 }}>{p.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" color={ink.ink} numberOfLines={1} lang="es">
                      {p.es}
                    </Text>
                    <Text variant="captionSm" color={ink.muted} numberOfLines={1}>
                      {p.en}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: accent.wash,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="headline" color={accent.accentInk}>
                      +
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── The tagging sheet: where the connective thread starts ── */}
      <Modal
        visible={sheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSheet(null)
        }}
      >
        <View
          style={{ flex: 1, backgroundColor: 'rgba(26,24,21,0.42)', justifyContent: 'flex-end' }}
        >
          <Pressable
            feedback="row"
            accessibilityLabel="Dismiss"
            onPress={() => {
              setSheet(null)
            }}
            style={{ flex: 1 }}
          >
            <View />
          </Pressable>

          <View
            style={{
              backgroundColor: surface.app,
              borderTopLeftRadius: radius['3xl'],
              borderTopRightRadius: radius['3xl'],
              padding: space['5'],
              paddingBottom: insets.bottom + space['5'],
              gap: space['3.5'],
            }}
          >
            <View
              style={{
                width: 42,
                height: 5,
                borderRadius: 2,
                backgroundColor: line.stronger,
                alignSelf: 'center',
              }}
            />

            {sheet !== null && (
              <>
                <Card>
                  <Row gap={11}>
                    <EmojiTile emoji={sheet.emoji} />
                    <View style={{ flex: 1 }}>
                      <Text variant="headline" color={ink.ink} lang="es">
                        {sheet.es}
                      </Text>
                      <Text variant="captionSm" color={ink.muted}>
                        {sheet.en}
                      </Text>
                    </View>
                  </Row>
                </Card>

                <Stack gap={9}>
                  <Text variant="caption" color={ink.ink}>
                    How hard is it for you?
                  </Text>
                  <Row gap={8}>
                    {(['easy', 'med', 'hard'] as const).map((d) => {
                      const meta = difficultyMeta[d]
                      const active = draftDiff === d
                      return (
                        <Pressable
                          key={d}
                          feedback="row"
                          accessibilityRole="radio"
                          accessibilityLabel={meta.label}
                          selected={active}
                          onPress={() => {
                            setDraftDiff(d)
                          }}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: 12,
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

                <Stack gap={9}>
                  <Row gap={7} align="baseline">
                    <Text variant="caption" color={ink.ink}>
                      What&apos;s tricky about it?
                    </Text>
                    <Text variant="captionSm" color={ink.muted}>
                      pick any
                    </Text>
                  </Row>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(Object.keys(tagMeta) as Tag[]).map((t) => {
                      const active = draftTags.includes(t)
                      return (
                        <Pressable
                          key={t}
                          feedback="smallButton"
                          accessibilityRole="checkbox"
                          accessibilityLabel={tagMeta[t].label}
                          selected={active}
                          onPress={() => {
                            setDraftTags((cur) =>
                              cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
                            )
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
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

                <Button label="Add to my stream" onPress={confirmAdd} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

export const unstable_settings = { initialRouteName: 'index' }
void router
