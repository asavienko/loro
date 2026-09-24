import { ReactNode, useEffect, useRef, useState } from 'react';
import { Level, Phrase, Tag, TOPICS } from '../content';
import { navigate } from '../nav/history';
import { useNav } from '../nav/NavContext';
import type { ExploreFilters } from '../nav/routes';
import { courseSets, coursePhrases, findSetView, phraseKey, promptOf } from '../state/catalog';
import { phraseProgress, setProgress } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Icon, IconName } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetCard } from '../ui/SetCard';
import { TONE } from '../ui/SetCover';

const LEVELS: Level[] = ['A1', 'A2', 'B1'];
const TAGS: Tag[] = ['question', 'request', 'politeness', 'food', 'directions', 'numbers', 'social'];

/** Case- and accent-insensitive folding, one output character per input character. */
const foldChar = (ch: string) => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().charAt(0) || ch;
export const fold = (text: string) => [...text].map(foldChar).join('');

/** The query as words: case, accents and punctuation don't count. */
export const queryWords = (query: string) => phraseKey(query).split(' ').filter(Boolean);

/** Every word of the query appears, in any order. */
export const matchesWords = (text: string, words: string[]) => {
  const haystack = phraseKey(text);
  return words.every((w) => haystack.includes(w));
};

/** Text with every occurrence of each query word marked. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  const chars = [...text];
  const folded = fold(text);
  const marked = chars.map(() => false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at !== -1; at = folded.indexOf(w, at + 1)) {
      for (let i = at; i < at + w.length; i++) marked[i] = true;
    }
  }
  const runs: { text: string; mark: boolean }[] = [];
  chars.forEach((ch, i) => {
    const last = runs[runs.length - 1];
    if (last && last.mark === marked[i]) last.text += ch;
    else runs.push({ text: ch, mark: marked[i] });
  });
  return (
    <>
      {runs.map((r, i) =>
        r.mark ? (
          <mark key={i} className="bg-primary-fixed text-on-primary-fixed rounded-sm">
            {r.text}
          </mark>
        ) : (
          r.text
        ),
      )}
    </>
  );
}

export function ExploreScreen({ filters }: { filters: ExploreFilters }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const now = useNow(30_000);
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const { learner } = state;
  const [text, setText] = useState(filters.q ?? '');
  const results = useRef<HTMLHeadingElement>(null);
  // Back and links can change the query; the field follows (derived during render).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q ?? '');
  }

  const update = (patch: Partial<ExploreFilters>, replace = false) => navigate({ name: 'explore', ...filters, ...patch }, { replace });
  // Typing replaces the history entry, so Back leaves Explore instead of undoing letters.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((filters.q ?? '') !== text.trim()) update({ q: text.trim() || undefined }, true);
    }, 250);
    return () => clearTimeout(id);
  });

  const words = queryWords(filters.q ?? '');
  const q = words.join(' ');
  const topic = TOPICS.find((t) => t.id === filters.topic);
  const phraseMatches = (p: Phrase) => {
    const set = findSetView(learner, p.setId);
    if (filters.topic && set?.topicId !== filters.topic) return false;
    if (filters.level && set?.level !== filters.level) return false;
    if (filters.tag && !p.tags.includes(filters.tag)) return false;
    if (!q) return true;
    const notes = [
      ...Object.values(p.notes ?? {}),
      ...Object.values(p.noteTranslations).flatMap((byLang) => Object.values(byLang ?? {})),
    ].map((n) => `${n.title} ${n.text}`).join(' ');
    const topicTitle = set?.topicId ? Object.values(TOPICS.find((t) => t.id === set.topicId)?.title ?? {}).join(' ') : '';
    const tags = p.tags.map((t) => c.common.tag[t]).join(' ');
    return matchesWords(`${p.target} ${Object.values(p.translations).join(' ')} ${notes} ${topicTitle} ${tags}`, words);
  };
  const phrases = q || filters.tag ? coursePhrases(learner).filter(phraseMatches) : [];
  const sets = courseSets(learner).filter((s) => {
    if (filters.topic && s.topicId !== filters.topic) return false;
    if (filters.level && s.level !== filters.level) return false;
    if (filters.tag && !s.phraseIds.some((id) => phrases.some((p) => p.id === id))) return false;
    if (!q) return true;
    const topicTitle = Object.values(TOPICS.find((t) => t.id === s.topicId)?.title ?? {}).join(' ');
    return matchesWords(`${s.title} ${Object.values(s.subtitle).join(' ')} ${topicTitle}`, words) || s.phraseIds.some((id) => phrases.some((p) => p.id === id));
  });

  const chips: { label: string; clear: Partial<ExploreFilters> }[] = [];
  if (topic) chips.push({ label: topic.title[locale], clear: { topic: undefined } });
  if (filters.level) chips.push({ label: filters.level, clear: { level: undefined } });
  if (filters.tag) chips.push({ label: c.common.tag[filters.tag], clear: { tag: undefined } });

  const pickTopic = (id: string) => {
    update({ topic: id });
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: 'start' }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-6">
      {/* The keyboard's Search key commits the query at once and puts the keyboard away. */}
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: text.trim() || undefined }, true);
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <Icon name="search" className="text-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
        <input
          type="search"
          enterKeyHint="search"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={c.explore.search}
          aria-label={c.explore.search}
          className="w-full min-h-12 pl-11 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 text-base text-on-surface placeholder:text-secondary focus-visible:outline-2"
        />
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-3">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-label={c.explore.removeFilter(chip.label)}
              onClick={() => update(chip.clear)}
              className="min-h-11 pl-3 pr-2 rounded-full bg-primary-container text-on-primary text-body font-semibold flex items-center gap-1"
            >
              {chip.label}
              <Icon name="close" className="text-icon-sm" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={() => navigate({ name: 'explore', q: filters.q })} className="min-h-11 px-3 rounded-full text-body font-semibold text-primary-container">
              {c.explore.clearFilters}
            </button>
          )}
        </div>
      )}

      {!topic && !q && (
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="font-serif text-heading font-semibold mb-2">{c.explore.topics}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TOPICS.map((t, i) => {
              const count = courseSets(learner).filter((s) => s.topicId === t.id).length;
              // An odd last tile spans the row instead of leaving a gap beside it.
              const spansRow = i === TOPICS.length - 1 && TOPICS.length % 2 === 1;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTopic(t.id)}
                  className={`relative min-h-20 rounded-2xl p-3 text-left flex flex-col justify-between overflow-hidden ${TONE[t.tone]} ${spansRow ? 'col-span-2 md:col-span-1' : ''}`}
                >
                  <span>
                    <span className="block text-row font-bold">{t.title[locale]}</span>
                    <span className="block text-label opacity-80">{c.explore.sets(count)}</span>
                  </span>
                  <Icon name={t.icon as IconName} className="text-icon-2xl self-end opacity-80" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <FilterRow label={c.explore.levels}>
        {LEVELS.filter((l) => courseSets(learner).some((s) => s.level === l)).map((l) => (
          <Chip key={l} selected={filters.level === l} onClick={() => update({ level: filters.level === l ? undefined : l })}>
            {l}
          </Chip>
        ))}
      </FilterRow>
      <FilterRow label={c.explore.tags}>
        {TAGS.map((t) => (
          <Chip key={t} selected={filters.tag === t} onClick={() => update({ tag: filters.tag === t ? undefined : t })}>
            {c.common.tag[t]}
          </Chip>
        ))}
      </FilterRow>

      {(q || filters.tag) && (
        <section aria-labelledby="phrase-results">
          <h2 id="phrase-results" className="font-serif text-heading font-semibold mb-1">{c.explore.phrases(phrases.length)}</h2>
          {phrases.length === 0 ? (
            <div className="py-2 flex flex-col items-start gap-2">
              <p className="text-body text-secondary">{c.explore.noPhrases(filters.q ?? '')}</p>
              {filters.q && (
                <button
                  type="button"
                  onClick={() => nav.addPhrase({ target: filters.q })}
                  className="min-h-11 px-4 rounded-full bg-surface-container text-on-surface text-body font-semibold flex items-center gap-1.5"
                >
                  <Icon name="add" className="text-icon-md" />
                  {c.explore.addAsOwn(filters.q)}
                </button>
              )}
            </div>
          ) : (
            <ul className="-mx-2">
              {phrases.map((p) => (
                <li key={p.id}>
                  <PhraseResult phrase={p} words={words} detail={progressLabel(c, phraseProgress(learner, p.id, now), now)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="set-results">
        <h2 id="set-results" ref={results} className="font-serif text-heading font-semibold mb-2 scroll-mt-20">
          {chips.length > 0 || q ? `${c.explore.filtered} · ${sets.length}` : c.explore.allSets}
        </h2>
        {sets.length === 0 ? (
          <p className="text-body text-secondary py-2">{c.explore.noSets}</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sets.map((set) => {
              const view = findSetView(learner, set.id)!;
              return (
                <li key={set.id}>
                  <SetCard wide view={view} progress={setProgress(learner, set.phraseIds, now)} onOpen={() => nav.openSet(set.id)} onPlay={() => nav.playSet(set.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhraseResult({ phrase, words, detail }: { phrase: Phrase; words: string[]; detail: string }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  if (!words.length) return <PhraseRow phrase={phrase} detail={detail} onPlay={() => nav.playPhraseInSet(phrase.id)} onMore={() => nav.showDetails(phrase.id)} />;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => nav.playPhraseInSet(phrase.id)}
        aria-label={c.phrase.play(phrase.target)}
        className="flex-1 min-w-0 min-h-14 pl-2 py-2 text-left rounded-2xl active:bg-surface-container"
      >
        <span lang={phrase.targetLang} className="block font-serif italic text-row truncate">
          <Highlight text={phrase.target} words={words} />
        </span>
        <span className="block text-label text-secondary truncate">
          <span lang={prompt.lang}>
            <Highlight text={prompt.text} words={words} />
          </span>
          <span> · {detail}</span>
        </span>
      </button>
      <button type="button" onClick={() => nav.showDetails(phrase.id)} aria-label={c.phrase.details(phrase.target)} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-secondary">
        <Icon name="more_vert" className="text-icon" />
      </button>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="-mt-2">
      <h2 className="text-label font-bold uppercase tracking-wider text-secondary mb-1.5">{label}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 px-4 rounded-full text-body font-semibold border ${
        selected ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface-container-low text-on-surface border-outline-variant/50'
      }`}
    >
      {children}
    </button>
  );
}
