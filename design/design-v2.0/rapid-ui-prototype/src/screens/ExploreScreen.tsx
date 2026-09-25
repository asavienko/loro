import { ReactNode, useEffect, useRef, useState } from 'react';
import { Level, Phrase, Tag, TOPICS } from '../content';
import { useSelectedInView } from '../lib/useSelectedInView';
import { navigate } from '../nav/history';
import { useNav } from '../nav/NavContext';
import type { ExploreFilters } from '../nav/routes';
import { courseSets, coursePhrases, findSetView, phraseKey, promptOf } from '../state/catalog';
import { clip, LIMITS, tidy } from '../state/limits';
import { displayLearner, phraseProgress, setProgress } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { Chip } from '../ui/Chip';
import { Icon, IconName } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetCard } from '../ui/SetCard';
import { TONE } from '../ui/SetCover';
import { btnIcon, btnText, btnTonal } from '../ui/button';
import { fieldClass } from '../ui/field';

const LEVELS: Level[] = ['A1', 'A2', 'B1'];
const TAGS: Tag[] = ['question', 'request', 'politeness', 'food', 'directions', 'numbers', 'social'];

/** Case- and accent-insensitive folding, one output character per input character. */
const foldChar = (ch: string) => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().charAt(0) || ch;
export const fold = (text: string) => [...text].map(foldChar).join('');

/** The query as words: case, accents and punctuation don't count. */
export const queryWords = (query: string) => phraseKey(query).split(' ').filter(Boolean);

/** Every word of the query starts a word of the text, in any order: "una" doesn't find
 * "cuenta", while "caf" still finds "café" as you type. */
export const matchesWords = (text: string, words: string[]) => {
  const haystack = phraseKey(text).split(' ');
  return words.every((w) => haystack.some((h) => h.startsWith(w)));
};

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Text with every occurrence of each query word marked. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  const chars = [...text];
  const folded = fold(text);
  const marked = chars.map(() => false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at !== -1; at = folded.indexOf(w, at + 1)) {
      // Only where a word starts, as the search matches.
      if (at > 0 && WORD_CHAR.test(folded[at - 1])) continue;
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
  const learner = displayLearner(state); // ratings in their undo window count in each status
  const [text, setText] = useState(filters.q ?? '');
  // Back and links can change the query; the field follows (derived during render).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q ?? '');
  }

  const chipRow = useRef<HTMLDivElement>(null);
  useSelectedInView(chipRow, `${filters.level}${filters.tag}`);
  const update = (patch: Partial<ExploreFilters>, replace = false) => navigate({ name: 'explore', ...filters, ...patch }, { replace });
  // Typing replaces the history entry, so Back leaves Explore instead of undoing letters.
  // The query keeps what was typed, spaces and all: trimming it here would write the
  // trimmed text back into the field and swallow the space between two words.
  useEffect(() => {
    const id = setTimeout(() => {
      const typed = text.trim() ? text : undefined;
      if (filters.q !== typed) update({ q: typed }, true);
    }, 250);
    return () => clearTimeout(id);
  });

  const words = queryWords(filters.q ?? '');
  const q = words.join(' ');
  const topic = TOPICS.find((t) => t.id === filters.topic);
  // Topics of this course only: another course's topic would show as an empty tile.
  const courseTopics = TOPICS.map((t) => ({ topic: t, count: courseSets(learner).filter((s) => s.topicId === t.id).length })).filter((t) => t.count > 0);
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
  // Matches in the phrase or its translation come before those only in notes, topics or tags.
  const inText = (p: Phrase) => matchesWords(`${p.target} ${Object.values(p.translations).join(' ')}`, words);
  const found = q || filters.tag ? coursePhrases(learner).filter(phraseMatches) : [];
  const phrases = q ? [...found.filter(inText), ...found.filter((p) => !inText(p))] : found;
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

  const showPhrases = Boolean(q || filters.tag);
  // A search or filter that finds nothing says so once, under the phrases, not again under the sets.
  const showSets = !(showPhrases && phrases.length === 0 && sets.length === 0);
  const setsHeading = topic
    ? `${topic.title[locale]} · ${c.explore.sets(sets.length)}`
    : q || filters.level || filters.tag
      ? `${c.explore.searchedSets} · ${sets.length}`
      : c.explore.allSets;

  // Levels and tags as one line of chips; with a level or tag on, the topics join them as chips.
  const filterRow = (
    <div ref={chipRow} className="scroll-row flex items-stretch gap-x-2 overflow-x-auto -mx-4 px-4">
      {!topic && !q && (filters.level || filters.tag) && (
        <>
          <ChipGroup label={c.explore.topics}>
            {courseTopics.map(({ topic: t }) => (
              <Chip key={t.id} selected={false} onClick={() => update({ topic: t.id })}>
                {t.title[locale]}
              </Chip>
            ))}
          </ChipGroup>
          <Divider />
        </>
      )}
      <ChipGroup label={c.explore.levels}>
        {LEVELS.filter((l) => courseSets(learner).some((s) => s.level === l)).map((l) => (
          <Chip key={l} selected={filters.level === l} onClick={() => update({ level: filters.level === l ? undefined : l })}>
            {l}
          </Chip>
        ))}
      </ChipGroup>
      <Divider />
      <ChipGroup label={c.explore.tags}>
        {TAGS.map((t) => (
          <Chip key={t} selected={filters.tag === t} onClick={() => update({ tag: filters.tag === t ? undefined : t })}>
            {c.common.tag[t]}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );

  const results = (
    <>
      {showPhrases && (
        <section aria-labelledby="phrase-results" className="max-w-3xl">
          <h2 id="phrase-results" className="font-serif text-heading font-semibold mb-1">{c.explore.phrases(phrases.length)}</h2>
          {phrases.length === 0 ? (
            <div className="py-2 flex flex-col items-start gap-2">
              <p className="text-body text-secondary">{filters.q ? c.explore.noPhrases(filters.q) : c.explore.noPhrasesFiltered}</p>
              {filters.q && (
                <button
                  type="button"
                  onClick={() => nav.addPhrase({ target: clip(tidy(filters.q ?? ''), LIMITS.phrase) })}
                  className={btnTonal}
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

      {showSets && (
        <section aria-labelledby="set-results">
          <h2 id="set-results" className="font-serif text-heading font-semibold mb-2">
            {setsHeading}
          </h2>
          {sets.length === 0 ? (
            <p className="text-body text-secondary py-2">{c.explore.noSets}</p>
          ) : (
            // Cards keep a readable size: two across a phone, as many as fit from 10rem up on wider screens.
            <ul className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-5">
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
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-col gap-4">
      {/* The keyboard's Search key commits the query at once and puts the keyboard away. */}
      <form
        role="search"
        className="relative max-w-3xl"
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
          className={`${fieldClass} w-full pl-11`}
        />
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 -my-1">
          {chips.map((chip) => (
            <Chip key={chip.label} removable aria-label={c.explore.removeFilter(chip.label)} onClick={() => update(chip.clear)}>
              {chip.label}
            </Chip>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={() => navigate({ name: 'explore', q: filters.q })} className={btnText}>
              {c.explore.clearFilters}
            </button>
          )}
        </div>
      )}

      {/* Nothing chosen yet: the topics, one row of tiles. Any filter or search puts them away. */}
      {!topic && !q && !filters.level && !filters.tag && (
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="sr-only">{c.explore.topics}</h2>
          {/* Tiles share the row from 6.5rem up (two and one on a 320 px phone); one never gets
              narrower than its longest word, so a long title (Russian "Повседневная") moves a tile
              to the next row instead of hyphenating as "Повсе-дневная". A word is broken only if it
              is wider than the whole row. The count stays with its noun ("2 набора"). */}
          <div className="flex flex-wrap gap-2">
            {courseTopics.map(({ topic: t, count }) => (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ topic: t.id })}
                className={`flex-[1_1_6.5rem] min-h-20 rounded-2xl p-3 text-left flex flex-col justify-between gap-1 ${TONE[t.tone]}`}
              >
                <span className="text-body font-bold leading-tight break-words">{t.title[locale]}</span>
                <span className="flex items-end justify-between gap-1">
                  <span className="min-w-0 text-label opacity-80 whitespace-nowrap">{c.explore.sets(count)}</span>
                  <Icon name={t.icon as IconName} className="shrink-0 text-icon-md opacity-80" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* A chosen topic is what the learner came for: its sets come first, the finer filters after. */}
      {topic ? (
        <>
          {results}
          {filterRow}
        </>
      ) : (
        <>
          {filterRow}
          {results}
        </>
      )}
    </div>
  );
}

function PhraseResult({ phrase, words, detail }: { phrase: Phrase; words: string[]; detail: string }) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  if (!words.length) return <PhraseRow phrase={phrase} detail={detail} onPlay={() => nav.playPhraseInSet(phrase.id)} onMore={() => nav.showDetails(phrase.id)} />;
  // As PhraseRow: your own phrase says so after its status.
  const status = phrase.own ? `${detail} · ${c.phrase.yoursShort}` : detail;
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
        {/* As PhraseRow: the prompt truncates, the status is never cut. */}
        <span className="flex flex-wrap gap-x-1 text-label text-secondary">
          <span className="max-w-full truncate">
            <span lang={prompt.lang}>
              <Highlight text={prompt.text} words={words} />
            </span>
            {' · '}
          </span>
          <span className="min-w-0">{status}</span>
        </span>
      </button>
      <button type="button" onClick={() => nav.showDetails(phrase.id)} aria-label={c.phrase.details(phrase.target)} className={`${btnIcon} text-secondary`}>
        <Icon name="more_vert" className="text-icon" />
      </button>
    </div>
  );
}

/** One kind of filter inside the chip line, named for screen readers ("Levels", "Tags"). */
function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-x-2">
      {children}
    </div>
  );
}

/** A hairline between two groups in the chip line. */
function Divider() {
  return <span aria-hidden="true" className="w-px shrink-0 my-2.5 bg-hairline" />;
}
