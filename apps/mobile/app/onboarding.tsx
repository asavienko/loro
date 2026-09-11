import { useLocale } from '../src/lib/i18n'
/**
 * Onboarding — Loro.dc.html:128–212, logic 2068–2174.
 *
 * Six steps: welcome → goal → level → time → packs → ready.
 * Seeds a REAL stream from the chosen packs, so the learner never lands in an empty app.
 *
 * The split, per plans/52: `STEPS` and `useOnboardingFlow` are the machine — the step order,
 * what has been answered, and what the two navigation buttons do. Everything below them is
 * presentation, one component per step, and every string it renders comes from `src/lib/copy.ts`.
 */
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Button,
  Card,
  EmojiTile,
  IconButton,
  Pressable,
  Row,
  Screen,
  SectionLabel,
  Stack,
  Text,
} from '../src/ui/primitives'
import {
  accent,
  barRadius,
  border,
  ink,
  line,
  onDark,
  radius,
  space,
  surface,
} from '../src/ui/theme'
import { useApp } from '../src/store'
import { useLearningCatalog } from '../src/store/learningCatalog'
import { LanguageChoices } from '../src/ui/components'
import {
  NATIVE_LANGUAGES,
  TARGET_LOCALES,
  type NativeLanguage,
  type TargetLocale,
  supportsPair,
} from '@loro/core'
import { copy } from '../src/lib/copy'
/**
 * One answer per step key, and deliberately loose.
 *
 * `string | string[]` is what a single-select and a multi-select step each store, so every read
 * of a multi answer casts. Tightening it — a discriminated map, or one field per step — would be
 * an improvement AND a risk: three of the casts feed `completeOnboarding` and one feeds the
 * summary, and getting the narrowing wrong changes which branch runs rather than failing to
 * compile. Left as it is, on purpose. See plans/52.
 */
type Answers = Record<string, string | string[]>
/** A step's key. Also the key its question, helper and option text are filed under in `copy`. */
type StepKey = 'goal' | 'level' | 'mins' | 'packs'
/**
 * An option's `val` is STRUCTURE — it is what `completeOnboarding` receives, and what
 * `answers` stores. The emoji, label and sub are text: `copy` for the three authored steps,
 * `@loro/content` for the packs.
 */
interface Option {
  val: string
  emoji: string
  label: string
  sub: string
}
type Step =
  | {
      kind: 'welcome'
    }
  | {
      kind: 'choice'
      key: StepKey
      multi?: boolean
      options: Option[]
    }
  | {
      kind: 'ready'
    }
type ChoiceStepDef = Extract<
  Step,
  {
    kind: 'choice'
  }
>
/** Pair each option's `val` with its text, in the order the step renders them. */
const choiceOptions = <V extends string>(
  order: readonly V[],
  text: Readonly<
    Record<
      V,
      Readonly<{
        emoji: string
        label: string
        sub: string
      }>
    >
  >,
): Option[] => order.map((val) => ({ val, ...text[val] }))
/**
 * The six steps.
 *
 * Built at MODULE LOAD, and the packs step reads `@loro/content` while it is — so the step list
 * cannot react to a catalog reload. That is today's behaviour; moving the filter into a `useMemo`
 * would be an improvement and a behaviour change at once, so it stays here.
 */
const buildSteps = (packs: ReturnType<typeof useLearningCatalog>['packs']): Step[] => [
  { kind: 'welcome' },
  {
    kind: 'choice',
    key: 'goal',
    options: choiceOptions(
      ['trip', 'convo', 'move', 'curious'] as const,
      copy.onboarding.steps.goal.options,
    ),
  },
  {
    kind: 'choice',
    key: 'level',
    options: choiceOptions(['beg', 'some', 'conf'] as const, copy.onboarding.steps.level.options),
  },
  {
    kind: 'choice',
    key: 'mins',
    options: choiceOptions(['5', '10', '20'] as const, copy.onboarding.steps.mins.options),
  },
  {
    kind: 'choice',
    key: 'packs',
    multi: true,
    // A pack's label and emoji are catalog content, not copy — only the count line is authored.
    options: packs
      .filter((p) => p.onboarding)
      .map((p) => ({
        val: p.id,
        emoji: p.emoji,
        label: p.label,
        sub: copy.onboarding.packSub(p.phrases.length),
      })),
  },
  { kind: 'ready' },
]

/**
 * The label the learner chose, for a single-select step — not the `val` behind it.
 *
 * The ready summary read `String(answers['goal'])` and printed the semantic id: a learner who
 * picked "Just curious" was shown `curious`, and one who picked "A trip coming up" was shown
 * `trip`. A summary of the answers has to be the answers, in the words they were offered in
 * (`P1-08`). `val`s are unique across the steps that use this, so the lookup is by step.
 */
const answerLabel = (key: StepKey, val: string | string[] | undefined): string | null => {
  if (typeof val !== 'string') return null
  const step = buildSteps([]).find((s) => s.kind === 'choice' && s.key === key)
  if (step?.kind !== 'choice') return null
  return step.options.find((o) => o.val === val)?.label ?? null
}

/** The gap between answer rows: 9, which is not a `space` step. One call site, so no token. */
const OPTION_GAP = 9
/** The unchosen indicator's ring — heavier than `border.selected`, and only ever here. */
const INDICATOR_BORDER = 2
/**
 * The form machine: which step is showing, what has been answered, and what Back and the
 * footer button do. Everything it returns is either state or a way to change it — no styling
 * and no strings.
 */
function useOnboardingFlow() {
  const { packs } = useLearningCatalog()
  const STEPS = buildSteps(packs)
  const complete = useApp((s) => s.completeOnboarding)
  const [step, setStep] = useState(
    Object.values(useApp.getState().courses).some((course) => course.onboarded) ? 4 : 0,
  )
  const [answers, setAnswers] = useState<Answers>(() => {
    const state = useApp.getState()
    return Object.values(state.courses).some((course) => course.onboarded)
      ? { packs: [], goal: state.goal ?? 'curious', mins: String(state.dailyMinutes) }
      : { packs: [] }
  })
  const current = STEPS[step]
  const value = current?.kind === 'choice' ? answers[current.key] : undefined
  const canContinue =
    current?.kind !== 'choice' ||
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
  const back = (): void => {
    setStep((s) => Math.max(0, s - 1))
  }
  const next = (): void => {
    if (current?.kind === 'ready') {
      const mins = Number(answers['mins'] ?? 10)
      complete({
        goal: String(answers['goal'] ?? 'curious'),
        // `level` used to be collected across a whole step and then dropped here, so the
        // question's helper described a setting that did not exist (`P1-04`). Nothing reads it
        // yet — plan 60's set selection is what biases on it — but it is stored, and
        // `completeOnboarding` now requires it, so a future question cannot go the same way.
        level: String(answers['level'] ?? 'beg'),
        // The three allowed daily budgets, and anything unrecognised is the middle one.
        // This ternary IS the domain rule; the mapping is exact on purpose.
        dailyMinutes: mins === 5 ? 5 : mins === 20 ? 20 : 10,
        packIds: answers['packs'] as string[],
      })
      router.replace('/')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  return { step, current, answers, value, canContinue, seedCount, choose, back, next }
}
export default function Onboarding() {
  useLocale()
  const flow = useOnboardingFlow()
  const current = flow.current
  if (current === undefined) return null
  return (
    <Screen>
      <StepRail step={flow.step} onBack={flow.back} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {current.kind === 'welcome' && (
          <>
            <WelcomeStep />
            <OnboardingLanguages />
          </>
        )}

        {current.kind === 'choice' && (
          <ChoiceStep step={current} value={flow.value} onChoose={flow.choose} />
        )}

        {current.kind === 'ready' && (
          <ReadyStep seedCount={flow.seedCount} answers={flow.answers} />
        )}
      </ScrollView>

      <OnboardingFooter
        label={ctaLabel(current.kind)}
        onPress={flow.next}
        disabled={!flow.canContinue}
      />
    </Screen>
  )
}
/** One button at the foot: it commits on the last step, and advances on every other. */
const ctaLabel = (kind: Step['kind']): string =>
  kind === 'welcome'
    ? copy.onboarding.cta.welcome
    : kind === 'ready'
      ? copy.onboarding.cta.ready
      : copy.onboarding.cta.next
/**
 * The footer that carries the one forward action.
 *
 * NOT the shared `ActionBar`. That bar is unconditionally `position: 'absolute'` and reserves no
 * space, which is right for a screen whose content scrolls under it — Today, phrase detail, the
 * Refrain. Onboarding's button sits BELOW the scroll view in the flow instead, and its two paddings
 * are `space['5']` and the inset, not the bar's `space['4']` / `space['3']`. One call site, one
 * shape, so it stays here rather than becoming a second mode on a component it shares nothing with.
 *
 * It reads the safe-area inset itself, the same way `ActionBar` does: forgetting to add it is how a
 * button ends up under the home indicator.
 */
function OnboardingFooter({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled: boolean
}) {
  useLocale()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.footer, { paddingBottom: insets.bottom + space['4'] }]}>
      <Button label={label} onPress={onPress} disabled={disabled} />
    </View>
  )
}
/**
 * The progress strip — one segment per step, filled up to the current one — with the back
 * affordance beside it. Not `Dots`: these are bars that share the width, not pips.
 */
function StepRail({ step, onBack }: { step: number; onBack: () => void }) {
  useLocale()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.rail, { paddingTop: insets.top + space['2'] }]}>
      <Row gap={space['1.5']}>
        {step > 0 && (
          <IconButton
            glyph={copy.common.chevron.left}
            label={copy.a11y.common.back}
            onPress={onBack}
            color={ink.ink3}
            variant="title3"
            style={s.back}
          />
        )}
        {buildSteps(useLearningCatalog().packs).map((_, i) => (
          <View
            key={i}
            style={[s.railSegment, { backgroundColor: i <= step ? accent.accent : line.default }]}
          />
        ))}
      </Row>
    </View>
  )
}
/** Step one: who Loro is, before asking the learner anything. */
function WelcomeStep() {
  useLocale()
  const welcome = copy.onboarding.welcome
  return (
    <View style={s.centred}>
      <View style={s.welcomeTile}>
        {/* Off the type scale on purpose — a 62 px `display` glyph overflows the 96 px plate. */}
        <Text variant="display" style={s.welcomeEmoji}>
          {welcome.emoji}
        </Text>
      </View>
      <Text variant="title2" color={accent.accentInk} align="center" lang="target">
        {welcome.greeting}
      </Text>
      <Text variant="title1" color={ink.ink} align="center">
        {welcome.title}
      </Text>
      <Text variant="caption" color={ink.ink3} align="center">
        {welcome.body}
      </Text>
    </View>
  )
}
/**
 * A question, its helper, and the answers.
 *
 * `multi` decides two things that must agree: the role each row announces
 * (`checkbox` / `radio`) and the mark a chosen row shows (a tick / a dot).
 */
function ChoiceStep({
  step,
  value,
  onChoose,
}: {
  step: ChoiceStepDef
  value: string | string[] | undefined
  onChoose: (key: string, val: string, multi: boolean) => void
}) {
  useLocale()
  const multi = step.multi === true
  const text = copy.onboarding.steps[step.key]
  return (
    <Stack gap={space['3']}>
      <Text variant="title2" color={ink.ink}>
        {text.question}
      </Text>
      <Text variant="caption" color={ink.muted}>
        {text.helper}
      </Text>
      <Stack gap={OPTION_GAP}>
        {step.options.map((o) => (
          <OptionRow
            key={o.val}
            option={o}
            multi={multi}
            selected={multi ? Array.isArray(value) && value.includes(o.val) : value === o.val}
            onPress={() => {
              onChoose(step.key, o.val, multi)
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}
/**
 * One answer.
 *
 * The chosen look is the accent tint plus the heavier `border.selected` — never colour alone.
 * `selected` is separate from that: it is what puts the state in the accessibility tree, and
 * without it a `radio` or `checkbox` announces its name and then nothing about being chosen.
 */
function OptionRow({
  option,
  selected,
  multi,
  onPress,
}: {
  option: Option
  selected: boolean
  multi: boolean
  onPress: () => void
}) {
  useLocale()
  return (
    <Pressable
      feedback="row"
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={copy.a11y.onboarding.option(option.label, option.sub)}
      selected={selected}
      onPress={onPress}
      style={[
        s.option,
        {
          backgroundColor: selected ? accent.tint : surface.card,
          borderWidth: selected ? border.selected : border.hairline,
          borderColor: selected ? accent.accent : line.strong,
        },
      ]}
    >
      <EmojiTile emoji={option.emoji} />
      <View style={s.optionText}>
        <Text variant="body" color={ink.ink}>
          {option.label}
        </Text>
        <Text variant="captionSm" color={ink.muted}>
          {option.sub}
        </Text>
      </View>
      <View
        style={[
          s.indicator,
          {
            borderWidth: selected ? 0 : INDICATOR_BORDER,
            backgroundColor: selected ? accent.accent : surface.card,
          },
        ]}
      >
        {selected && (
          <Text variant="captionSm" color={onDark.primary}>
            {multi ? copy.common.marks.check : copy.common.marks.dot}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
/** The last step: what was chosen, and how many phrases are really waiting. */
function ReadyStep({ seedCount, answers }: { seedCount: number; answers: Answers }) {
  useLocale()
  const ready = copy.onboarding.ready
  const mins = String(answers['mins'] ?? 10)
  return (
    <View style={s.centred}>
      {/* Off the type scale, like the welcome parrot. */}
      <Text variant="display" style={s.readyEmoji}>
        {ready.emoji}
      </Text>
      <Text variant="title2" color={accent.accentInk}>
        {ready.title}
      </Text>
      <Text variant="title2" color={ink.ink} align="center">
        {ready.seeded(seedCount)}
      </Text>
      <Text variant="caption" color={ink.ink3} align="center">
        {ready.sessionReady(mins)}
      </Text>
      {/* All FOUR answers, as FS §1 and `P1-08` require. Level was missing because the field
          behind it was dropped at commit; goal and level show the label the learner chose
          rather than the `val` the store keeps. */}
      <Card style={s.summary}>
        <Stack gap={space['2']}>
          <SummaryRow
            label={ready.summary.goal}
            value={answerLabel('goal', answers['goal']) ?? copy.common.noValue}
          />
          <SummaryRow
            label={ready.summary.level}
            value={answerLabel('level', answers['level']) ?? copy.common.noValue}
          />
          <SummaryRow label={ready.summary.daily} value={ready.summary.minutes(mins)} />
          <SummaryRow
            label={ready.summary.packs}
            value={ready.summary.packsSelected((answers['packs'] as string[]).length)}
          />
        </Stack>
      </Card>
    </View>
  )
}
/** A label and its value, opposite ends of one line. Three of them make the summary card. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  useLocale()
  return (
    <Row justify="space-between" wrap>
      <SectionLabel size="sm">{label}</SectionLabel>
      <Text variant="captionSm" color={ink.ink} align="right" style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </Row>
  )
}
const s = StyleSheet.create({
  rail: { paddingHorizontal: space['5'] },
  back: { paddingRight: space['2'] },
  /** 5 px tall, and `barRadius` because `radius.sm` is 8 — far too round for this. */
  railSegment: { flex: 1, height: 5, borderRadius: barRadius },
  content: { padding: space['5'], gap: space['4'], flexGrow: 1 },
  /** Welcome and ready both centre a short column in whatever height is left. */
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['3'] },
  welcomeTile: {
    width: 96,
    height: 96,
    borderRadius: radius['3xl'],
    backgroundColor: accent.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeEmoji: { fontSize: 50, lineHeight: 58 },
  readyEmoji: { fontSize: 44, lineHeight: 52 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: radius.lg,
    padding: 14,
  },
  optionText: { flex: 1 },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderColor: line.stronger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { width: '100%', marginTop: space['3'] },
  footer: { padding: space['5'] },
})
function OnboardingLanguages() {
  useLocale()
  const native = useApp((state) => state.nativeLanguage)
  const target = useApp((state) => state.targetLocale)
  const setLanguages = useApp((state) => state.setLanguages)
  const chooseNative = (next: NativeLanguage): void => {
    setLanguages(next, supportsPair(next, target) ? target : 'es-ES')
  }
  return (
    <Stack gap={space['3']}>
      <LanguageChoices
        title={copy.languages.native}
        values={NATIVE_LANGUAGES}
        selected={native}
        onSelect={chooseNative}
      />
      <LanguageChoices
        title={copy.languages.target}
        values={TARGET_LOCALES.filter((value) => supportsPair(native, value))}
        selected={target}
        onSelect={(next: TargetLocale) => {
          setLanguages(native, next)
        }}
      />
    </Stack>
  )
}
