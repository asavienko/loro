import { ReactNode, useState } from 'react';
import type { Phrase, PhraseNotes } from '../content';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';

export type NoteTab = keyof PhraseNotes;

export const NOTE_TABS: { id: NoteTab; icon: IconName }[] = [
  { id: 'mnemonic', icon: 'lightbulb' },
  { id: 'grammar', icon: 'menu_book' },
  { id: 'pronunciation', icon: 'record_voice_over' },
];

/** The phrase's notes as tabs. Notes are in English for now, and say so in other UIs. */
export function PhraseNotesView({ phrase, prefix }: { phrase: Phrase; prefix: string }) {
  const c = useCopy();
  const notes = phrase.notes;
  const available = notes ? NOTE_TABS.filter((t) => notes[t.id]) : [];
  const [tab, setTab] = useState<NoteTab | null>(available[0]?.id ?? null);
  if (!notes || !tab || available.length === 0) return null;
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
              tab === t.id ? 'bg-surface-container-lowest text-on-surface font-bold shadow-sm' : 'text-secondary font-medium'
            }`}
          >
            <Icon name={t.icon} className="text-icon-sm" />
            {c.phrase.notes[t.id]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId(prefix, tab)} aria-labelledby={tabId(prefix, tab)} lang="en">
        <NoteBody notes={notes} tab={tab} />
      </div>
      {!c.locale.startsWith('en') && <p className="text-label text-secondary px-1">{c.phrase.notesInEnglish}</p>}
    </div>
  );
}

function NoteBody({ notes, tab }: { notes: PhraseNotes; tab: NoteTab }) {
  if (tab === 'mnemonic' && notes.mnemonic) return <Note title={notes.mnemonic.title} text={notes.mnemonic.text} />;
  if (tab === 'grammar' && notes.grammar) return <Note title={notes.grammar.title} text={notes.grammar.text} />;
  if (tab === 'pronunciation' && notes.pronunciation) {
    return (
      <Note title={notes.pronunciation.title} text={notes.pronunciation.text}>
        <p className="font-mono text-body text-primary-container">{notes.pronunciation.ipa}</p>
        <p className="font-mono text-label text-secondary">{notes.pronunciation.respelling}</p>
      </Note>
    );
  }
  return null;
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
