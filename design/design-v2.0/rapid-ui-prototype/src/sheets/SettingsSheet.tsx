import { SelectHTMLAttributes, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { bestVoice, speak, voicesFor } from '../audio/speech';
import { useLatest } from '../lib/useLatest';
import { useVoiceList } from '../lib/useVoiceList';
import { courseSets, findPhrase, promptOf } from '../state/catalog';
import { LIMITS, tidy } from '../state/limits';
import { Icon } from '../ui/Icon';
import { copyForNative, languageLabel, languageName } from '../copy';
import { coursesFor, LanguageCode, NATIVE_LANGUAGES } from '../content';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';
import { Sheet, SheetSection } from '../ui/Sheet';
import { fieldClass } from '../ui/field';

/**
 * Opened from the avatar: course and profile, voices, listening and one screen-reader preference.
 * `atVoices` (from the player's voice line) opens it on the voice pickers.
 */
export function SettingsSheet({ open, atVoices = false, onClose }: { open: boolean; atVoices?: boolean; onClose: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { profile } = state.learner;
  const announceId = useId();
  const pauseId = useId();
  const { toast } = useToast();

  // A new course empties the queue (it belongs to the old one); say so, in the new UI language.
  const switchTo = (nativeLang: LanguageCode, targetLang: LanguageCode) => {
    if (nativeLang === profile.nativeLang && targetLang === profile.targetLang) return;
    const queueCleared = state.player.order.length > 0;
    actions.setProfile({ nativeLang, targetLang });
    const next = copyForNative(nativeLang);
    toast(next.settings.switched(languageName(targetLang, next.locale), queueCleared));
  };

  return (
    <Sheet open={open} title={c.settings.title} onClose={onClose}>
      <SheetSection title={c.settings.profile}>
        {/* The setting people come here for comes first. */}
        <LanguageSelect
          label={c.settings.course}
          value={profile.targetLang}
          options={coursesFor(profile.nativeLang)}
          name={(code) => languageLabel(code, c.locale)}
          onChange={(code) => switchTo(profile.nativeLang, code)}
        />
        <NameField initial={profile.name} label={c.settings.name} onSave={(name) => actions.setProfile({ name })} />
        <LanguageSelect
          label={c.settings.native}
          value={profile.nativeLang}
          options={NATIVE_LANGUAGES}
          name={(code) => languageLabel(code, code)}
          onChange={(code) => {
            const course = coursesFor(code).includes(profile.targetLang) ? profile.targetLang : coursesFor(code)[0];
            switchTo(code, course);
          }}
        />
        <p className="px-2 text-label text-secondary">{c.settings.courseNote}</p>
      </SheetSection>

      <VoicePickers langs={[profile.targetLang, profile.nativeLang]} focusFirst={atVoices} />

      {/* How long "your turn" lasts; every duration shown uses it, so they stay real. */}
      <SheetSection title={c.settings.listening}>
        <fieldset className="px-2 py-1" aria-describedby={pauseId}>
          <legend className="text-label text-secondary mb-1">{c.settings.pauseLength}</legend>
          {/* Side by side, or one above the other when large text makes them too narrow. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
            {(['standard', 'longer'] as const).map((length) => (
              <label
                key={length}
                className={`min-h-12 px-3 rounded-2xl border flex items-center gap-2 cursor-pointer text-body ${
                  state.prefs.pauseLength === length ? 'border-inverse-surface bg-surface-container-low font-semibold' : 'border-hairline'
                }`}
              >
                <input
                  type="radio"
                  name="pause-length"
                  checked={state.prefs.pauseLength === length}
                  onChange={() => actions.setPrefs({ pauseLength: length })}
                  className="w-5 h-5 accent-inverse-surface"
                />
                {c.settings.pause[length]}
              </label>
            ))}
          </div>
          <p id={pauseId} className="mt-1 text-label text-secondary">{c.settings.pauseHint}</p>
        </fieldset>
      </SheetSection>

      <SheetSection title={c.settings.accessibility}>
        <div className="min-h-12 px-2 flex items-center gap-3">
          <input
            id={announceId}
            type="checkbox"
            role="switch"
            checked={state.prefs.announceEveryStep}
            onChange={(e) => actions.setPrefs({ announceEveryStep: e.target.checked })}
            className="w-5 h-5 accent-primary-container"
          />
          <label htmlFor={announceId} className="flex-1 cursor-pointer">
            <span className="block text-row font-medium">{c.settings.announceEveryStep}</span>
            <span className="block text-label text-secondary">{c.settings.announceHint}</span>
          </label>
        </div>
      </SheetSection>

    </Sheet>
  );
}

function NameField({ initial, label, onSave }: { initial: string; label: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  // Saved on blur, and when the sheet closes with the field still focused (Escape, Back):
  // an element removed from the page fires no blur.
  const latest = useLatest({ name, initial, onSave });
  const savedAs = useRef<string | null>(null);
  const store = () => {
    const { name: typed, initial: stored, onSave: save } = latest.current;
    if (tidy(typed) === stored || tidy(typed) === savedAs.current) return false;
    savedAs.current = tidy(typed);
    save(typed);
    return true;
  };
  const onBlur = () => {
    // Only spacing changed: show it as stored.
    if (!store() && name !== initial && tidy(name) === initial) setName(initial);
  };
  useEffect(() => () => void store(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // A new stored name (saved here, or synced from another device) shows in the field unless
  // the learner is part-way through typing something else; their text then wins on blur.
  const shown = useRef(initial);
  useEffect(() => {
    if (name === shown.current || tidy(name) === initial) setName(initial);
    shown.current = initial;
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="flex flex-col gap-1 px-2 py-1">
      <span className="text-label text-secondary">{label}</span>
      <input
        value={name}
        maxLength={LIMITS.name}
        onChange={(e) => setName(e.target.value)}
        onBlur={onBlur}
        autoComplete="given-name"
        enterKeyHint="done"
        // Saved on blur; Enter blurs.
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
        className={fieldClass}
      />
    </label>
  );
}

function LanguageSelect({ label, value, options, name, onChange }: { label: string; value: LanguageCode; options: LanguageCode[]; name: (code: LanguageCode) => string; onChange: (code: LanguageCode) => void }) {
  return (
    <label className="flex flex-col gap-1 px-2 py-1">
      <span className="text-label text-secondary">{label}</span>
      <SelectBox value={value} onChange={(e) => onChange(e.target.value as LanguageCode)}>
        {options.map((code) => (
          <option key={code} value={code}>
            {name(code)}
          </option>
        ))}
      </SelectBox>
    </label>
  );
}

/** A voice per language, shown only where the device has more than one to choose from. */
function VoicePickers({ langs, focusFirst }: { langs: LanguageCode[]; focusFirst: boolean }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const section = useRef<HTMLDivElement>(null);
  // Read afresh whenever the device's voice list changes (some load late).
  const { ready } = useVoiceList();
  const voices: Partial<Record<LanguageCode, SpeechSynthesisVoice[]>> = ready ? Object.fromEntries(langs.map((l) => [l, voicesFor(l)])) : {};
  const choosable = langs.filter((l) => (voices[l]?.length ?? 0) > 1);
  const hasChoice = choosable.length > 0;
  // Opened from the player's voice line: straight to the pickers, once the sheet has taken focus.
  useEffect(() => {
    if (!focusFirst || !hasChoice) return;
    const timer = setTimeout(() => {
      section.current?.scrollIntoView({ block: 'start' });
      section.current?.querySelector('select')?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [focusFirst, hasChoice]);
  if (!hasChoice) return null;
  // The course's first phrase, in each language, to hear a voice before keeping it.
  const sample = findPhrase(state.learner, courseSets(state.learner)[0]?.phraseIds[0]);
  const sampleText = (lang: LanguageCode) => (!sample ? '' : lang === sample.targetLang ? sample.target : promptOf(sample, lang).text);
  return (
    <div ref={section} className="mt-3 scroll-mt-2">
    <SheetSection title={c.settings.voices}>
      {choosable.map((lang) => {
        const list = voices[lang]!;
        const chosen = state.prefs.voiceByLang[lang];
        return (
          // The Test button sits beside the label, not in it, so the select's name stays the language.
          <div key={lang} className="flex flex-wrap items-end gap-2 px-2 py-1">
            {/* At least 12rem for the voice name; on a narrow phone Test wraps below. */}
            <label className="flex-1 min-w-[12rem] flex flex-col gap-1">
              <span className="text-label text-secondary">{languageLabel(lang, c.locale)}</span>
              <SelectBox
                value={chosen && list.some((v) => v.name === chosen) ? chosen : ''}
                onChange={(e) => actions.setPrefs({ voiceByLang: { ...state.prefs.voiceByLang, [lang]: e.target.value || undefined } })}
              >
                <option value="">{c.settings.voiceAuto(bestVoice(list, lang)?.name ?? '')}</option>
                {list.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </SelectBox>
            </label>
            {sampleText(lang) && (
              <button
                type="button"
                aria-label={c.onboarding.test(languageName(lang, c.locale))}
                onClick={() => {
                  // One voice at a time: the sample would cut the player off mid-phrase. The
                  // pause commits first (its effect stops the player's speech), then the sample.
                  if (state.player.status === 'playing') flushSync(() => actions.pause());
                  void speak(sampleText(lang), lang, state.prefs.speed).done;
                }}
                className="shrink-0 min-h-12 px-3 rounded-full bg-surface-container text-body font-semibold flex items-center gap-1.5"
              >
                <Icon name="volume_up" className="text-icon-sm" />
                {c.onboarding.testShort}
              </button>
            )}
          </div>
        );
      })}
    </SheetSection>
    </div>
  );
}

/**
 * A select drawn by the app: WebKit (every browser on iOS) keeps its native look and
 * ignores the height, leaving a 26 px target; without it the 48 px height holds.
 */
function SelectBox(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex">
      <select
        {...props}
        className={`${fieldClass} appearance-none w-full min-w-0 pl-3 pr-10`}
      />
      <Icon name="keyboard_arrow_down" className="text-icon absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary" />
    </span>
  );
}
