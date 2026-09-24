import { ReactNode, useState } from 'react';
import { findPhrase, getLanguage, getSet, PhraseNotes } from '../content';
import { progressLabel } from '../lib/progressLabel';
import { panelId, tabId, tabListKeyDown } from '../lib/tabs';
import { phraseProgress } from '../state/selectors';
import { useNow, useStore } from '../state/store';
import { Sheet } from './Sheet';

type NoteTab = keyof PhraseNotes;

export const NOTE_TABS: { id: NoteTab; label: string; icon: string }[] = [
  { id: 'mnemonic', label: 'Memory tip', icon: 'lightbulb' },
  { id: 'grammar', label: 'Grammar', icon: 'menu_book' },
  { id: 'pronunciation', label: 'Sounds', icon: 'record_voice_over' },
];

const TABS = 'phrase-notes';

interface PhraseDetailsSheetProps {
  phraseId: string | null;
  onClose: () => void;
  /** Plays the phrase in its set's queue. */
  onPlay: (phraseId: string) => void;
}

export function PhraseDetailsSheet({ phraseId, onClose, onPlay }: PhraseDetailsSheetProps) {
  const phrase = findPhrase(phraseId);
  return (
    <Sheet open={Boolean(phrase)} title={phrase ? getSet(phrase.setId).title : ''} onClose={onClose}>
      {phrase && <PhraseDetails phraseId={phrase.id} onPlay={() => onPlay(phrase.id)} />}
    </Sheet>
  );
}

function PhraseDetails({ phraseId, onPlay }: { phraseId: string; onPlay: () => void }) {
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const phrase = findPhrase(phraseId)!;
  const notes = phrase.notes ?? {};
  const available = NOTE_TABS.filter((t) => notes[t.id]);
  const [tab, setTab] = useState<NoteTab | null>(available[0]?.id ?? null);
  const saved = state.learner.savedPhraseIds.includes(phrase.id);
  const progress = phraseProgress(state.learner, phrase.id, now);
  const language = getLanguage(phrase.target.lang);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p lang={phrase.target.lang} className="font-serif italic text-2xl font-semibold text-on-surface leading-snug">
          {phrase.target.text}
        </p>
        <p className="text-sm text-secondary mt-1">{phrase.native.text}</p>
        <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1.5">
          <span aria-label={language.name} role="img">{language.flag}</span>
          <span>{progressLabel(progress, now)}</span>
          {progress.memory && <span>· heard {progress.memory.heardCount}×</span>}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPlay}
          className="flex-1 min-h-12 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center gap-2 active:opacity-90"
        >
          <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[22px]">play_arrow</span>
          Play
        </button>
        <button
          type="button"
          onClick={() => actions.toggleSavePhrase(phrase.id)}
          aria-pressed={saved}
          className="min-h-12 px-5 rounded-full bg-surface-container text-on-surface font-semibold flex items-center gap-2 active:bg-surface-container-high"
        >
          <span aria-hidden="true" className={`material-symbols-outlined text-[22px] text-primary-container ${saved ? 'material-symbols-fill' : ''}`}>
            favorite
          </span>
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {available.length > 0 && tab && (
        <div className="flex flex-col gap-3">
          <div
            role="tablist"
            aria-label="Phrase notes"
            onKeyDown={tabListKeyDown(TABS, available.map((t) => t.id), tab, setTab)}
            className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-2xl"
          >
            {available.map((t) => (
              <button
                key={t.id}
                id={tabId(TABS, t.id)}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={panelId(TABS, t.id)}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-xl flex items-center justify-center gap-1.5 text-xs ${
                  tab === t.id ? 'bg-surface-container-lowest text-on-surface font-bold shadow-sm' : 'text-secondary font-medium'
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={panelId(TABS, tab)} aria-labelledby={tabId(TABS, tab)}>
            <NoteBody notes={notes} tab={tab} />
          </div>
        </div>
      )}
    </div>
  );
}

export function NoteBody({ notes, tab }: { notes: PhraseNotes; tab: NoteTab }) {
  if (tab === 'mnemonic' && notes.mnemonic) {
    return <Note title={notes.mnemonic.title} text={notes.mnemonic.text} />;
  }
  if (tab === 'grammar' && notes.grammar) {
    return <Note title={notes.grammar.title} text={notes.grammar.text} />;
  }
  if (tab === 'pronunciation' && notes.pronunciation) {
    return (
      <Note title={notes.pronunciation.title} text={notes.pronunciation.text}>
        <p className="font-mono text-sm text-primary-container">{notes.pronunciation.ipa}</p>
        <p className="font-mono text-xs text-secondary">{notes.pronunciation.respelling}</p>
      </Note>
    );
  }
  return null;
}

function Note({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      {children}
      <p className="text-sm text-on-surface-variant leading-relaxed">{text}</p>
    </div>
  );
}
