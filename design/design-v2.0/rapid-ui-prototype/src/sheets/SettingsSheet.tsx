import { useId, useState } from 'react';
import { languageName } from '../copy';
import { coursesFor, LanguageCode, NATIVE_LANGUAGES } from '../content';
import { serializeState } from '../state/persistence';
import { useCopy, useStore } from '../state/store';
import { Sheet, SheetOption, SheetSection } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** Opened from the avatar: profile and course, one screen-reader preference, and developer tools last. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const { profile } = state.learner;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const announceId = useId();

  const copyProgress = async () => {
    try {
      await navigator.clipboard.writeText(serializeState(state));
      toast(c.settings.copied, { tone: 'success' });
    } catch {
      toast(c.settings.copyUnavailable);
    }
  };

  return (
    <>
      <Sheet open={open} title={c.settings.title} onClose={onClose}>
        <SheetSection title={c.settings.profile}>
          <NameField key={profile.name} initial={profile.name} label={c.settings.name} onSave={(name) => actions.setProfile({ name })} />
          <LanguageSelect
            label={c.settings.native}
            value={profile.nativeLang}
            options={NATIVE_LANGUAGES}
            name={(code) => languageName(code, code)}
            onChange={(code) => {
              const course = coursesFor(code).includes(profile.targetLang) ? profile.targetLang : coursesFor(code)[0];
              actions.setProfile({ nativeLang: code, targetLang: course });
            }}
          />
          <LanguageSelect
            label={c.settings.course}
            value={profile.targetLang}
            options={coursesFor(profile.nativeLang)}
            name={(code) => languageName(code, c.locale)}
            onChange={(code) => actions.setProfile({ targetLang: code })}
          />
          <p className="px-2 text-label text-secondary">{c.settings.courseNote}</p>
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

        <SheetSection title={c.settings.developer}>
          <p className="px-2 text-label text-secondary mb-1">{c.settings.developerHint}</p>
          <SheetOption icon="content_copy" label={c.settings.copyJson} onClick={() => void copyProgress()} />
          <SheetOption icon="restart_alt" label={c.settings.reset} tone="danger" onClick={() => setConfirmOpen(true)} />
        </SheetSection>
      </Sheet>

      <Sheet open={confirmOpen} title={c.settings.resetTitle} onClose={() => setConfirmOpen(false)}>
        <p className="text-body text-on-surface-variant px-1">{c.settings.resetBody}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={() => setConfirmOpen(false)} className="min-h-12 rounded-full bg-surface-container font-semibold">
            {c.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              actions.reset();
              setConfirmOpen(false);
              onClose();
            }}
            className="min-h-12 rounded-full bg-error text-on-error font-bold"
          >
            {c.settings.resetConfirm}
          </button>
        </div>
      </Sheet>
    </>
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
        className="min-h-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
      />
    </label>
  );
}

function LanguageSelect({ label, value, options, name, onChange }: { label: string; value: LanguageCode; options: LanguageCode[]; name: (code: LanguageCode) => string; onChange: (code: LanguageCode) => void }) {
  return (
    <label className="flex flex-col gap-1 px-2 py-1">
      <span className="text-label text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        className="min-h-12 px-3 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base"
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {name(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
