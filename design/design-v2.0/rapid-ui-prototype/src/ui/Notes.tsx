import { ReactNode, useState } from 'react';
import type { Phrase, PhraseNotes } from '../content';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { useCopy, useStore } from '../state/store';
import { Icon, IconName } from './Icon';

export type NoteTab = keyof PhraseNotes;

export const NOTE_TABS: { id: NoteTab; icon: IconName }[] = [
  { id: 'mnemonic', icon: 'lightbulb' },
  { id: 'grammar', icon: 'menu_book' },
  { id: 'pronunciation', icon: 'record_voice_over' },
];

/** The phrase's notes as tabs, in the learner's language where they have it (in English otherwise, and say so). */
export function PhraseNotesView({ phrase, prefix }: { phrase: Phrase; prefix: string }) {
  const c = useCopy();
  const { state } = useStore();
  const native = state.learner.profile.nativeLang;
  const notes = phrase.notes;
  const available = NOTE_TABS.filter((t) => notes[t.id]);
  const [chosen, setTab] = useState<NoteTab | null>(available[0]?.id ?? null);
  // The phrase can change under an open sheet (the player moves on): a tab it lacks falls
  // back to its first, rather than an empty panel with no tab selected.
  const tab = chosen && available.some((t) => t.id === chosen) ? chosen : (available[0]?.id ?? null);
  if (!tab) return null;
  const translated = native === 'en-GB' ? undefined : phrase.noteTranslations[tab]?.[native];
  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label={c.phrase.notesTitle}
        className="grid gap-1 p-1 bg-surface-container-low rounded-2xl"
        style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}
      >
        {available.map((t) => (
          <button
            key={t.id}
            id={tabId(prefix, t.id)}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={panelId(prefix, t.id)}
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={tabListKeyDown(prefix, available.map((a) => a.id), tab, setTab)}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-xl flex items-center justify-center gap-1.5 text-label ${
              tab === t.id ? 'bg-surface-container-lowest text-on-surface font-bold shadow-card' : 'text-secondary font-medium'
            }`}
          >
            <Icon name={t.icon} className="text-icon-sm" />
            {c.phrase.notes[t.id]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId(prefix, tab)} aria-labelledby={tabId(prefix, tab)} lang={translated ? native : 'en'}>
        <NoteBody notes={notes} tab={tab} translation={translated} />
      </div>
      {!c.locale.startsWith('en') && !translated && <p className="text-label text-secondary px-1">{c.phrase.notesInEnglish}</p>}
    </div>
  );
}

function NoteBody({ notes, tab, translation }: { notes: PhraseNotes; tab: NoteTab; translation?: { title: string; text: string } }) {
  const note = notes[tab];
  if (!note) return null;
  const { title, text } = translation ?? note;
  if (tab === 'pronunciation' && notes.pronunciation) {
    return (
      <Note title={title} text={text}>
        <p className="font-mono text-body text-primary-container">{notes.pronunciation.ipa}</p>
        {/* The respelling uses English spelling, so it only helps in the English UI. */}
        {!translation && <p className="font-mono text-label text-secondary">{notes.pronunciation.respelling}</p>}
      </Note>
    );
  }
  return <Note title={title} text={text} />;
}

function Note({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <h3 className="text-body font-bold text-on-surface">{title}</h3>
      {children}
      <p className="text-body text-on-surface-variant leading-relaxed">{text}</p>
    </div>
  );
}
