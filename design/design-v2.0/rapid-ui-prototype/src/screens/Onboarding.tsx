import { useLayoutEffect, useRef, useState } from 'react';
import { speak, voiceName } from '../audio/speech';
import { useVoiceList } from '../lib/useVoiceList';
import { languageLabel, languageName } from '../copy';
import { coursesFor, getLanguage, LanguageCode, NATIVE_LANGUAGES } from '../content';
import { useNav } from '../nav/NavContext';
import { courseSets, findPhrase, promptOf } from '../state/catalog';
import { LIMITS } from '../state/limits';
import { useCopy, useStore } from '../state/store';
import { Icon, IconName } from '../ui/Icon';
import { btnPrimary, btnTonal } from '../ui/button';
import { fieldClass } from '../ui/field';

type Step = 'native' | 'name' | 'course' | 'voices' | 'loop';

/** Past this share of the screen a pinned action hides the step it is for. */
const PIN_MAX_SHARE = 0.4;

/**
 * Whether the step's action can stay pinned: not when it would cover more than 40% of the screen
 * (a small phone at large text, where it wraps to four lines), so the step shows on arrival and
 * the action follows it in the page.
 */
function usePinnable() {
  const ref = useRef<HTMLDivElement>(null);
  const [pinnable, setPinnable] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Its height is the same pinned or not, so this can't flip back and forth.
    const check = () => setPinnable(el.offsetHeight <= window.innerHeight * PIN_MAX_SHARE);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    window.addEventListener('resize', check);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);
  return [ref, pinnable] as const;
}
/** The step's action: Home's hero radius, so at large text it wraps as a rounded block, not an oval. */
const PRIMARY = `${btnPrimary.replace('rounded-full', 'rounded-3xl')} w-full py-2`;
const STEPS: Step[] = ['native', 'name', 'course', 'voices', 'loop'];

/** First run: languages, name, a voice check before anything plays, and the loop in one screen. */
export function Onboarding() {
  const c = useCopy();
  const nav = useNav();
  const { state, actions } = useStore();
  const { profile } = state.learner;
  const [step, setStep] = useState<Step>('native');
  const [name, setName] = useState(profile.name);
  const at = STEPS.indexOf(step);
  const [strip, pinned] = usePinnable();
  // The name is kept as the learner goes on (like the languages), so a reload doesn't lose it.
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
    <main className="min-h-dvh bg-surface text-on-surface flex flex-col px-6 pt-[calc(2rem+env(safe-area-inset-top))] max-w-md mx-auto">
      {/* How far along, drawn; the step text says it in words. */}
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="flex-1 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= at ? 'bg-primary-container' : 'bg-surface-container-high'}`} />
          ))}
        </div>
        <p className="shrink-0 text-label font-semibold text-secondary">{c.onboarding.step(at + 1, STEPS.length)}</p>
      </div>
      <h1 className="font-serif text-display font-semibold mt-4">Loro</h1>
      {at === 0 && <p className="text-body text-secondary mt-1 text-pretty">{c.onboarding.welcome}</p>}

      <div className={`flex-1 flex flex-col gap-3 ${at === 0 ? 'mt-8' : 'mt-6'}`}>
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
          <label className="flex flex-col gap-2">
            <span className="font-serif text-title font-semibold">{c.onboarding.name}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              enterKeyHint="next"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  next();
                }
              }}
              maxLength={LIMITS.name}
              placeholder={c.onboarding.namePlaceholder}
              className={fieldClass}
            />
          </label>
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
        {step === 'loop' && (
          <section>
            <h2 className="font-serif text-title font-semibold mb-3">{c.onboarding.loop}</h2>
            <ol className="flex flex-col gap-3">
              {c.onboarding.loopSteps(native, target).map((text, i) => (
                <li key={text} className="flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                    <Icon name={(['hearing', 'record_voice_over', 'volume_up', 'task_alt'] as IconName[])[i]} className="text-icon-md" />
                  </span>
                  <span className="text-body pt-1.5 text-pretty">{text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* Only the step's action is pinned, so it stays on screen however long the step or large
          the text without hiding the step itself; the quieter choices follow it in the page. */}
      <div
        ref={strip}
        data-pinned={pinned}
        className={`-mx-6 px-6 pt-3 mt-3 ${at === 0 ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'} bg-surface flex flex-col ${pinned ? 'sticky bottom-0 before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-linear-to-t before:from-surface before:to-transparent before:pointer-events-none' : 'relative'}`}
      >
        {step === 'loop' ? (
          <button type="button" onClick={() => finish(true)} className={PRIMARY}>
            <Icon name="play_arrow" fill className="text-icon" />
            {c.onboarding.start}
          </button>
        ) : (
          <button type="button" onClick={next} className={PRIMARY}>
            {c.onboarding.next}
          </button>
        )}
      </div>
      {(step === 'loop' || at > 0) && (
        // The pinned strip's safe-area padding is for when it is stuck; here it would be a gap.
        <div className="-mt-[env(safe-area-inset-bottom)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-1">
          {step === 'loop' && (
            <button type="button" onClick={() => finish(false)} className="min-h-12 rounded-full text-primary-container font-semibold">
              {c.onboarding.skip}
            </button>
          )}
          {at > 0 && (
            <button type="button" onClick={() => setStep(STEPS[at - 1])} className="min-h-11 rounded-full text-secondary font-semibold">
              {c.common.back}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function Choice({ legend, options, label, value, onChange }: { legend: string; options: LanguageCode[]; label: (code: LanguageCode) => string; value: LanguageCode; onChange: (code: LanguageCode) => void }) {
  return (
    // min-w-0: a fieldset is at least as wide as its widest word by default, which at large text on
    // a small phone pushed the page sideways.
    <fieldset className="min-w-0 flex flex-col gap-2">
      <legend className="font-serif text-title font-semibold mb-2 break-words hyphens-auto">{legend}</legend>
      {options.map((code) => (
        <label key={code} className={`min-h-12 px-4 py-1 rounded-2xl border flex flex-wrap items-center gap-x-3 cursor-pointer ${value === code ? 'border-inverse-surface bg-surface-container-low' : 'border-hairline'}`}>
          {/* Chosen is ink, as in Settings: terracotta is for Play and the step's action. */}
          <input type="radio" name={legend} checked={value === code} onChange={() => onChange(code)} className="w-5 h-5 accent-inverse-surface" />
          <span aria-hidden="true">{getLanguage(code).flag}</span>
          <span className="text-row font-semibold">{label(code)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Checks the device has voices for both languages before the first play. */
function VoiceCheck() {
  const c = useCopy();
  const { state } = useStore();
  const { profile } = state.learner;
  // Re-renders when the voice list changes, so a late-loading voice stops showing as missing.
  const { ready } = useVoiceList();
  const sample = findPhrase(state.learner, courseSets(state.learner)[0]?.phraseIds[0]);
  const langs: LanguageCode[] = [profile.nativeLang, profile.targetLang];
  const missing = ready && langs.some((l) => !voiceName(l));
  return (
    <section aria-live="polite">
      <h2 className="font-serif text-title font-semibold mb-3">{c.onboarding.voices}</h2>
      {!ready ? (
        <p className="text-body text-secondary">{c.onboarding.voicesChecking}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {langs.map((lang) => {
            const voice = voiceName(lang);
            const text = sample ? (lang === profile.targetLang ? sample.target : promptOf(sample, lang).text) : '';
            return (
              <li key={lang} className="flex flex-wrap items-center gap-2 min-h-12">
                <Icon name={voice ? 'check_circle' : 'error'} className={`text-icon ${voice ? 'text-tertiary' : 'text-error'}`} />
                <span className="flex-1 text-body">
                  {voice ? c.onboarding.voiceOk(languageLabel(lang, c.locale), voice) : c.onboarding.voiceMissing(languageLabel(lang, c.locale))}
                </span>
                {voice && text && (
                  // The row already names the language; the button says only what it does.
                  <button
                    type="button"
                    aria-label={c.onboarding.test(languageName(lang, c.locale))}
                    onClick={() => void speak(text, lang, 1).done}
                    className={`${btnTonal} ml-auto`}
                  >
                    <Icon name="volume_up" className="text-icon-sm" />
                    {c.onboarding.testShort}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {missing && <p className="text-body text-secondary mt-3">{c.onboarding.voiceHint}</p>}
    </section>
  );
}
