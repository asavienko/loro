import { SelectHTMLAttributes, useEffect, useId, useState } from 'react';
import { bestVoice, speak, voicesFor, waitForVoices } from '../audio/speech';
import { courseSets, findPhrase, promptOf } from '../state/catalog';
import { Icon } from '../ui/Icon';
import { copyForNative, languageLabel, languageName } from '../copy';
import { coursesFor, LanguageCode, NATIVE_LANGUAGES } from '../content';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';
import { Sheet, SheetSection } from '../ui/Sheet';

/** Opened from the avatar: profile and course, and one screen-reader preference. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { profile } = state.learner;
  const announceId = useId();
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
        <NameField key={profile.name} initial={profile.name} label={c.settings.name} onSave={(name) => actions.setProfile({ name })} />
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
        <LanguageSelect
          label={c.settings.course}
          value={profile.targetLang}
          options={coursesFor(profile.nativeLang)}
          name={(code) => languageLabel(code, c.locale)}
          onChange={(code) => switchTo(profile.nativeLang, code)}
        />
        <p className="px-2 text-label text-secondary">{c.settings.courseNote}</p>
      </SheetSection>

      <VoicePickers langs={[profile.targetLang, profile.nativeLang]} />

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
  return (
    <label className="flex flex-col gap-1 px-2 py-1">
      <span className="text-label text-secondary">{label}</span>
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== initial && onSave(name)}
        autoComplete="given-name"
        enterKeyHint="done"
        // Saved on blur; Enter blurs.
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
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
function VoicePickers({ langs }: { langs: LanguageCode[] }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const [voices, setVoices] = useState<Partial<Record<LanguageCode, SpeechSynthesisVoice[]>>>({});
  useEffect(() => {
    let live = true;
    void waitForVoices().then(() => live && setVoices(Object.fromEntries(langs.map((l) => [l, voicesFor(l)]))));
    return () => {
      live = false;
    };
  }, [langs[0], langs[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const choosable = langs.filter((l) => (voices[l]?.length ?? 0) > 1);
  if (choosable.length === 0) return null;
  // The course's first phrase, in each language, to hear a voice before keeping it.
  const sample = findPhrase(state.learner, courseSets(state.learner)[0]?.phraseIds[0]);
  const sampleText = (lang: LanguageCode) => (!sample ? '' : lang === sample.targetLang ? sample.target : promptOf(sample, lang).text);
  return (
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
                onClick={() => void speak(sampleText(lang), lang, state.prefs.speed).done}
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
        className="appearance-none w-full min-w-0 min-h-12 pl-3 pr-10 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
      />
      <Icon name="keyboard_arrow_down" className="text-icon absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary" />
    </span>
  );
}
