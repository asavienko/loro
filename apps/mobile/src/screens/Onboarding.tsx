// First run (the web prototype's src/screens/Onboarding.tsx): the learner's language, their name,
// the course, a voice check before anything plays, and the loop explained. The step's action stays
// at the bottom; the step scrolls above it.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { speak, voiceName, waitForVoices } from '@shared/audio/speech';
import { languageLabel, languageName } from '@shared/copy';
import { coursesFor, getLanguage, LanguageCode, NATIVE_LANGUAGES } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { courseSets, findPhrase, promptOf } from '@shared/state/catalog';
import { LIMITS } from '@shared/state/limits';
import { useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
import { SignIn } from './AccountScreen';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius, type } from '../ui/theme';

type Step = 'native' | 'name' | 'course' | 'voices' | 'account' | 'loop';
/** Signing in comes before the loop is explained (plan 106): optional, and "Continue" skips it. */
const STEPS: Step[] = ['native', 'name', 'course', 'voices', 'account', 'loop'];
const LOOP_ICONS: IconName[] = ['hearing', 'record_voice_over', 'volume_up', 'task_alt'];

export function Onboarding() {
  const c = useCopy();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { state, actions } = useStore();
  const account = useAccount();
  const { profile } = state.learner;
  const [step, setStep] = useState<Step>('native');
  const [name, setName] = useState(profile.name);
  const at = STEPS.indexOf(step);
  const next = () => {
    if (step === 'name' && name.trim() !== profile.name) actions.setProfile({ name: name.trim() });
    setStep(STEPS[at + 1]);
  };
  const native = languageName(profile.nativeLang, c.locale);
  const target = languageName(profile.targetLang, c.locale);

  const finish = (demo: boolean) => {
    actions.setProfile({ onboarded: true, name: name.trim() });
    if (!demo) actions.setPrefs({ skippedDemo: true });
    const first = courseSets(state.learner)[0]?.phraseIds[0];
    if (demo && first) {
      nav.playList([first], 0, { kind: 'demo' });
      nav.openPlayer();
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.column}>
        <View style={styles.progressRow}>
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.progress}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.progressStep, { backgroundColor: i <= at ? colors.primaryContainer : colors.surfaceContainerHigh }]} />
            ))}
          </View>
          <Txt variant="label" weight={600} color="secondary">
            {c.onboarding.step(at + 1, STEPS.length)}
          </Txt>
        </View>
        <Txt variant="display" face="serif" weight={600} accessibilityRole="header" style={styles.brand}>
          Loro
        </Txt>
        {at === 0 && (
          <Txt color="secondary" style={styles.welcome}>
            {c.onboarding.welcome}
          </Txt>
        )}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={[styles.column, styles.bodyContent]} keyboardShouldPersistTaps="handled">
        {step === 'native' && (
          <Choice
            legend={c.onboarding.native}
            options={NATIVE_LANGUAGES}
            // Each language in its own name, so the learner can find theirs.
            label={(code) => languageLabel(code, code)}
            value={profile.nativeLang}
            onChange={(code) => {
              const course = coursesFor(code).includes(profile.targetLang) ? profile.targetLang : coursesFor(code)[0];
              actions.setProfile({ nativeLang: code, targetLang: course });
            }}
          />
        )}
        {step === 'name' && (
          <View style={styles.gap}>
            <Txt variant="title" face="serif" weight={600} nativeID="name-label">
              {c.onboarding.name}
            </Txt>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabelledBy="name-label"
              accessibilityLabel={c.onboarding.name}
              autoComplete="given-name"
              returnKeyType="next"
              onSubmitEditing={next}
              maxLength={LIMITS.name}
              placeholder={c.onboarding.namePlaceholder}
              placeholderTextColor={colors.secondary}
              style={styles.field}
            />
          </View>
        )}
        {step === 'course' && (
          <Choice
            legend={c.onboarding.course}
            options={coursesFor(profile.nativeLang)}
            label={(code) => languageLabel(code, c.locale)}
            value={profile.targetLang}
            onChange={(code) => actions.setProfile({ targetLang: code })}
          />
        )}
        {step === 'voices' && <VoiceCheck />}
        {step === 'account' &&
          (account.status === 'signedIn' ? (
            <View style={styles.gap}>
              <Icon name="account_circle" size="3xl" color="primaryContainer" />
              <Txt variant="title" face="serif" weight={600}>
                {c.account.signedInAs(account.account?.email ?? '')}
              </Txt>
            </View>
          ) : (
            <SignIn embedded onDone={next} />
          ))}
        {step === 'loop' && (
          <View>
            <Txt variant="title" face="serif" weight={600} accessibilityRole="header" style={styles.sectionTitle}>
              {c.onboarding.loop}
            </Txt>
            {c.onboarding.loopSteps(native, target).map((text, i) => (
              <View key={text} style={styles.loopRow}>
                <View style={styles.loopIcon}>
                  <Icon name={LOOP_ICONS[i]} size="md" color="onPrimaryFixed" />
                </View>
                <Txt style={styles.loopText}>{text}</Txt>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.column, styles.actions]}>
        {step === 'loop' ? (
          <Button variant="primary" icon="play_arrow" iconFill label={c.onboarding.start} onPress={() => finish(true)} />
        ) : (
          <Button variant={step === 'account' && account.status !== 'signedIn' ? 'tonal' : 'primary'} label={step === 'account' && account.status !== 'signedIn' ? c.account.notNow : c.onboarding.next} onPress={next} />
        )}
        {step === 'loop' && <Button variant="text" label={c.onboarding.skip} onPress={() => finish(false)} />}
        {at > 0 && <Button variant="text" color="secondary" label={c.common.back} onPress={() => setStep(STEPS[at - 1])} />}
      </View>
    </View>
  );
}

/** One language of several: a radio row; the chosen one is ink, as in Settings. */
function Choice({ legend, options, label, value, onChange }: { legend: string; options: LanguageCode[]; label: (code: LanguageCode) => string; value: LanguageCode; onChange: (code: LanguageCode) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={legend} style={styles.gap}>
      <Txt variant="title" face="serif" weight={600} style={styles.sectionTitle}>
        {legend}
      </Txt>
      {options.map((code) => {
        const chosen = value === code;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            accessibilityLabel={label(code)}
            onPress={() => onChange(code)}
            style={({ pressed }) => [styles.option, chosen ? styles.optionOn : styles.optionOff, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.radio, chosen && styles.radioOn]}>{chosen && <View style={styles.radioDot} />}</View>
            <Txt variant="row">{getLanguage(code).flag}</Txt>
            <Txt variant="row" weight={600} lang={code}>
              {label(code)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The device's voices for both languages, checked before the first play, each with a test. */
function VoiceCheck() {
  const c = useCopy();
  const { state } = useStore();
  const { profile } = state.learner;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    void waitForVoices(3000).then(() => on && setReady(true));
    return () => {
      on = false;
    };
  }, []);
  const sample = findPhrase(state.learner, courseSets(state.learner)[0]?.phraseIds[0]);
  const langs: LanguageCode[] = [profile.nativeLang, profile.targetLang];
  const missing = ready && langs.some((l) => !voiceName(l));
  return (
    <View accessibilityLiveRegion="polite">
      <Txt variant="title" face="serif" weight={600} accessibilityRole="header" style={styles.sectionTitle}>
        {c.onboarding.voices}
      </Txt>
      {!ready ? (
        <Txt color="secondary">{c.onboarding.voicesChecking}</Txt>
      ) : (
        langs.map((lang) => {
          const voice = voiceName(lang);
          const text = sample ? (lang === profile.targetLang ? sample.target : promptOf(sample, lang).text) : '';
          return (
            <View key={lang} style={styles.voiceRow}>
              <Icon name={voice ? 'check_circle' : 'error'} color={voice ? 'tertiary' : 'error'} />
              <Txt style={styles.voiceText}>
                {voice ? c.onboarding.voiceOk(languageLabel(lang, c.locale), voice) : c.onboarding.voiceMissing(languageLabel(lang, c.locale))}
              </Txt>
              {voice && text ? (
                <Button
                  variant="tonal"
                  icon="volume_up"
                  label={c.onboarding.testShort}
                  accessibilityLabel={c.onboarding.test(languageName(lang, c.locale))}
                  onPress={() => void speak(text, lang, 1).done}
                />
              ) : null}
            </View>
          );
        })
      )}
      {missing && (
        <Txt color="secondary" style={styles.hint}>
          {c.onboarding.voiceHint}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  column: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressStep: { flex: 1, height: 4, borderRadius: radius.full },
  brand: { marginTop: 16 },
  welcome: { marginTop: 4 },
  body: { flex: 1 },
  bodyContent: { paddingTop: 28, paddingBottom: 16, gap: 12 },
  gap: { gap: 8 },
  sectionTitle: { marginBottom: 8 },
  field: {
    ...type.field,
    fontFamily: 'sans-400',
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.onSurface,
  },
  option: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius['2xl'], borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionOn: { borderColor: colors.inverseSurface, backgroundColor: colors.surfaceContainerLow },
  optionOff: { borderColor: colors.hairline },
  radio: { width: 20, height: 20, borderRadius: radius.full, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.inverseSurface },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.inverseSurface },
  loopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  loopIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  loopText: { flex: 1, paddingTop: 7 },
  voiceRow: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  voiceText: { flex: 1, minWidth: 160 },
  hint: { marginTop: 12 },
  actions: { paddingTop: 12, gap: 4 },
});
