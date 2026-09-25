import { useState } from 'react';
import { TOPICS, type Phrase } from '../content';
import { coursePhrases, findSetView, promptOf } from '../state/catalog';
import { useCopy, useStore } from '../state/store';
import { matchesWords, queryWords } from '../screens/ExploreScreen';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { btnTonal } from '../ui/button';
import { fieldClass } from '../ui/field';

/**
 * Adds phrases to one of your own sets from the set itself: the course's phrases, found with the
 * same word matching as Explore, each with an Add / Added toggle. A toggle acts at once; Done
 * closes the sheet.
 */
export function PickPhrasesSheet({ setId, onClose }: { setId: string | null; onClose: () => void }) {
  const c = useCopy();
  return (
    <Sheet open={setId !== null} title={c.set.addPhrases} onClose={onClose}>
      {setId && <Picker setId={setId} onClose={onClose} />}
    </Sheet>
  );
}

function Picker({ setId, onClose }: { setId: string; onClose: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const [text, setText] = useState('');
  const { learner } = state;
  const set = findSetView(learner, setId);
  if (!set) return null;
  const inSet = new Set(learner.ownSets[setId]?.phraseIds ?? []);
  const words = queryWords(text);

  // Searchable as in Explore: the phrase, its translations, its set and topic, its tags.
  const matches = (p: Phrase) => {
    if (words.length === 0) return true;
    const from = findSetView(learner, p.setId);
    const topic = from?.topicId ? Object.values(TOPICS.find((t) => t.id === from.topicId)?.title ?? {}).join(' ') : '';
    const tags = p.tags.map((t) => c.common.tag[t]).join(' ');
    return matchesWords(`${p.target} ${Object.values(p.translations).join(' ')} ${from?.title ?? ''} ${topic} ${tags}`, words);
  };
  // Grouped as the course is: each set's phrases under its name, your own phrases first.
  const found = coursePhrases(learner).filter(matches);
  const groups: { key: string; title: string; lang?: string; phrases: Phrase[] }[] = [];
  const own = found.filter((p) => p.own);
  if (own.length > 0) groups.push({ key: 'own', title: c.phrase.yoursShort, phrases: own });
  for (const p of found.filter((q) => !q.own)) {
    const last = groups[groups.length - 1];
    if (last && last.key === p.setId) last.phrases.push(p);
    else {
      const from = findSetView(learner, p.setId);
      groups.push({ key: p.setId ?? p.id, title: from?.title ?? '', lang: from?.targetLang, phrases: [p] });
    }
  }

  return (
    <div className="flex flex-col">
      {/* The field stays at the top while the list scrolls under it. */}
      <form
        role="search"
        className="sticky -top-3 z-10 -mx-4 -mt-3 px-4 pt-3 pb-2 bg-surface"
        onSubmit={(event) => {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <Icon name="search" className="text-icon absolute left-7.5 top-[calc(50%+0.125rem)] -translate-y-1/2 text-secondary" />
        <input
          type="search"
          enterKeyHint="search"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={c.pickPhrases.search}
          aria-label={c.pickPhrases.search}
          className={`${fieldClass} w-full pl-11`}
        />
      </form>

      {groups.length === 0 ? (
        <p className="text-body text-secondary py-3">{c.explore.noPhrases(text.trim())}</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="mt-2">
            <h3 lang={group.lang} className="font-serif text-body font-semibold text-secondary py-1">
              {group.title}
            </h3>
            {/* At large text the toggle keeps its icon and gives its word's room to the phrase. */}
            <ul className="@container">
              {group.phrases.map((p) => {
                const added = inSet.has(p.id);
                const prompt = promptOf(p, learner.profile.nativeLang);
                return (
                  <li key={p.id} className="min-h-14 flex items-center gap-3 py-1.5">
                    <span className="flex-1 min-w-0">
                      <span lang={p.targetLang} className="block font-serif italic text-row leading-snug break-words">
                        {p.target}
                      </span>
                      <span lang={prompt.lang} className="block text-label text-secondary truncate">
                        {prompt.text}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-pressed={added}
                      onClick={() => (added ? actions.removeFromSet(setId, p.id) : actions.addToSet(setId, [p.id]))}
                      className={`min-h-11 min-w-[5.5rem] px-3 @max-[16rem]:min-w-11 @max-[16rem]:px-0 shrink-0 rounded-full inline-flex items-center justify-center gap-1 text-body font-semibold ${
                        added ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container-high text-on-surface active:bg-surface-container-highest'
                      }`}
                    >
                      <Icon name={added ? 'check' : 'add'} className="text-icon-md" />
                      <span className="@max-[16rem]:sr-only">{added ? c.pickPhrases.added : c.pickPhrases.add}</span>
                      <span lang={p.targetLang} className="sr-only">
                        {' '}
                        {p.target}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      <div className="sticky -bottom-3 -mx-4 -mb-3 mt-2 px-4 pt-2 pb-3 bg-surface">
        <button type="button" onClick={onClose} className={`${btnTonal} w-full`}>
          {c.pickPhrases.done}
        </button>
      </div>
    </div>
  );
}
