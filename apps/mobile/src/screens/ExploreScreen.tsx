// Explore (the web prototype's src/screens/ExploreScreen.tsx): search the course, and browse it by
// topic, level and tag. The filters live in the route, so Back and links restore them.
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Level, librarySets, Phrase, Tag, TOPICS } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import type { ExploreFilters } from '@shared/nav/routes';
import { courseSets, coursePhrases, findSetView, phraseKey, promptOf } from '@shared/state/catalog';
import { clip, LIMITS, tidy } from '@shared/state/limits';
import { displayLearner, phraseProgress, setProgress } from '@shared/state/selectors';
import { hrefOf } from '../nav/Shell';
import { useCopy, useNow, useStore } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { PhraseRow } from '../ui/PhraseRow';
import { MakeSetButton, PhraseShelves } from './PhraseShelves';
import { progressLabel } from '../ui/progressLabel';
import { SetCard } from '../ui/SetCard';
import { TONE } from '../ui/SetCover';
import { TopBar } from '../ui/TopBar';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET, type } from '../ui/theme';

const LEVELS: Level[] = ['A1', 'A2', 'B1'];
const TAGS: Tag[] = ['question', 'request', 'politeness', 'food', 'directions', 'numbers', 'social'];
/** Typing waits this long before it becomes the route's query. */
const QUERY_DEBOUNCE_MS = 250;
/** Set cards keep a readable size: two across a phone, more as the screen widens. */
const CARD_MIN = 150;
const CARD_GAP = 12;
const PAGE_PAD = 16;
const PAGE_MAX = 1152;
/** Above this text size the whole placeholder no longer fits the field; it says just "Search". */
const LARGE_TEXT = 1.3;

/** Case- and accent-insensitive folding, one output character per input character. */
const foldChar = (ch: string) => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().charAt(0) || ch;
export const fold = (text: string) => [...text].map(foldChar).join('');

/** The query as words: case, accents and punctuation don't count. */
export const queryWords = (query: string) => phraseKey(query).split(' ').filter(Boolean);

/** Every word of the query starts a word of the text, in any order: "una" doesn't find "cuenta",
 * while "caf" still finds "café" as you type. */
export const matchesWords = (text: string, words: string[]) => {
  const haystack = phraseKey(text).split(' ');
  return words.every((w) => haystack.some((h) => h.startsWith(w)));
};

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Text with every occurrence of each query word marked, where a word starts (as the search matches). */
function Highlight({ text, words }: { text: string; words: string[] }) {
  const chars = [...text];
  const folded = fold(text);
  const marked = chars.map(() => false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at !== -1; at = folded.indexOf(w, at + 1)) {
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
          // A nested Text keeps the face and size of the line it is in.
          <Text key={i} style={styles.mark}>
            {r.text}
          </Text>
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
  const router = useRouter();
  const { state } = useStore();
  const now = useNow(30_000);
  const { width, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const learner = displayLearner(state); // ratings in their undo window count in each status
  const [text, setText] = useState(filters.q ?? '');
  // Back and links can change the query; the field follows (derived during render).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q ?? '');
  }
  const update = (patch: Partial<ExploreFilters>) => router.navigate(hrefOf({ name: 'explore', ...filters, ...patch }) as never);
  // The query keeps what was typed, spaces and all: trimming it here would write the trimmed text
  // back into the field and swallow the space between two words.
  useEffect(() => {
    const id = setTimeout(() => {
      const typed = text.trim() ? text : undefined;
      if (filters.q !== typed) update({ q: typed });
    }, QUERY_DEBOUNCE_MS);
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
    const notes = [...Object.values(p.notes ?? {}), ...Object.values(p.noteTranslations).flatMap((byLang) => Object.values(byLang ?? {}))]
      .map((n) => `${n.title} ${n.text}`)
      .join(' ');
    const topicTitle = set?.topicId ? Object.values(TOPICS.find((t) => t.id === set.topicId)?.title ?? {}).join(' ') : '';
    const tags = p.tags.map((t) => c.common.tag[t]).join(' ');
    return matchesWords(`${p.target} ${Object.values(p.translations).join(' ')} ${notes} ${topicTitle} ${tags}`, words);
  };
  // Matches in the phrase or its translation come before those only in notes, topics or tags.
  const inText = (p: Phrase) => matchesWords(`${p.target} ${Object.values(p.translations).join(' ')}`, words);
  const found = q || filters.tag ? coursePhrases(learner).filter(phraseMatches) : [];
  const phrases = q ? [...found.filter(inText), ...found.filter((p) => !inText(p))] : found;
  // Loro's course, then the learner's own and saved sets (plan 106).
  const sets = [...courseSets(learner), ...librarySets(learner.profile.targetLang)].filter((s) => {
    if (filters.topic && s.topicId !== filters.topic) return false;
    if (filters.level && s.level !== filters.level) return false;
    if (filters.tag && !s.phraseIds.some((id) => phrases.some((p) => p.id === id))) return false;
    if (!q) return true;
    const topicTitle = Object.values(TOPICS.find((t) => t.id === s.topicId)?.title ?? {}).join(' ');
    return matchesWords(`${s.title} ${Object.values(s.subtitle ?? {}).join(' ')} ${s.description ?? ''} ${topicTitle}`, words) || s.phraseIds.some((id) => phrases.some((p) => p.id === id));
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
  // Nothing chosen yet: the topics are a row of tiles.
  const tiles = !topic && !q && !filters.level && !filters.tag;

  // The grid's measured width (a web scrollbar takes some of the window); the window until then.
  const pageWidth = measured ?? Math.min(width, PAGE_MAX) - PAGE_PAD * 2;
  const columns = Math.max(2, Math.floor((pageWidth + CARD_GAP) / (CARD_MIN + CARD_GAP)));
  const cardWidth = Math.floor((pageWidth - CARD_GAP * (columns - 1)) / columns);

  // Levels and tags as one line of chips; with a level or tag on, the topics join them as chips.
  const filterRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chipRow}>
      {!topic && !q && !tiles && (
        <>
          <ChipGroup label={c.explore.topics}>
            {courseTopics.map(({ topic: t }) => (
              <Chip key={t.id} label={t.title[locale]} onPress={() => update({ topic: t.id })} />
            ))}
          </ChipGroup>
          <Divider />
        </>
      )}
      <ChipGroup label={c.explore.levels}>
        {LEVELS.filter((l) => courseSets(learner).some((s) => s.level === l)).map((l) => (
          <Chip key={l} label={l} selected={filters.level === l} onPress={() => update({ level: filters.level === l ? undefined : l })} />
        ))}
      </ChipGroup>
      <Divider />
      <ChipGroup label={c.explore.tags}>
        {TAGS.map((t) => (
          <Chip key={t} label={c.common.tag[t]} selected={filters.tag === t} onPress={() => update({ tag: filters.tag === t ? undefined : t })} />
        ))}
      </ChipGroup>
    </ScrollView>
  );

  const results = (
    <>
      {showPhrases && (
        <View>
          <Txt variant="heading" face="serif" weight={600} accessibilityRole="header" style={styles.heading}>
            {c.explore.phrases(phrases.length)}
          </Txt>
          {phrases.length === 0 ? (
            <View style={styles.empty}>
              <Txt color="secondary">{filters.q ? c.explore.noPhrases(filters.q) : c.explore.noPhrasesFiltered}</Txt>
              {filters.q && (
                <View style={styles.wrap}>
                  <Button variant="tonal" icon="auto_awesome" label={c.make.fromExplore(filters.q)} onPress={() => nav.makeSet({ input: filters.q })} />
                  <Button variant="tonal" icon="add" label={c.explore.addAsOwn(filters.q)} onPress={() => nav.addPhrase({ target: clip(tidy(filters.q ?? ''), LIMITS.phrase) })} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {phrases.map((p) => (
                <PhraseResult key={p.id} phrase={p} words={words} detail={progressLabel(c, phraseProgress(learner, p.id, now), now)} />
              ))}
            </View>
          )}
        </View>
      )}

      {showSets && (
        <View>
          <Txt variant="heading" face="serif" weight={600} accessibilityRole="header" style={styles.heading}>
            {setsHeading}
          </Txt>
          {sets.length === 0 ? (
            <Txt color="secondary" style={styles.emptyLine}>
              {c.explore.noSets}
            </Txt>
          ) : (
            <View style={styles.grid} onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
              {sets.map((set) => {
                const view = findSetView(learner, set.id);
                if (!view) return null;
                return (
                  <SetCard
                    key={set.id}
                    width={cardWidth}
                    view={view}
                    progress={setProgress(learner, set.phraseIds, now)}
                    onOpen={() => nav.openSet(set.id)}
                    onPlay={() => nav.playSet(set.id)}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.screen}>
      <TopBar title={c.tabs.explore} onOpenSettings={nav.openSettings} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View accessibilityRole="search" style={styles.search}>
          <View style={styles.searchIcon} pointerEvents="none">
            <Icon name="search" color="secondary" />
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            accessibilityLabel={c.explore.search}
            placeholder={fontScale > LARGE_TEXT ? c.explore.searchShort : c.explore.search}
            placeholderTextColor={colors.secondary}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            // The keyboard's Search key commits the query at once.
            onSubmitEditing={() => update({ q: text.trim() || undefined })}
            style={styles.field}
          />
        </View>

        {chips.length > 0 && (
          <View style={styles.wrap}>
            {chips.map((chip) => (
              <RemovableChip key={chip.label} label={chip.label} accessibilityLabel={c.explore.removeFilter(chip.label)} onPress={() => update(chip.clear)} />
            ))}
            {chips.length > 1 && <Button variant="text" label={c.explore.clearFilters} onPress={() => router.navigate(hrefOf({ name: 'explore', q: filters.q }) as never)} />}
          </View>
        )}

        {tiles && <MakeSetButton />}
        {tiles && (
          <View accessibilityLabel={c.explore.topics} style={styles.tiles}>
            {courseTopics.map(({ topic: t, count }) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`${t.title[locale]}, ${c.explore.sets(count)}`}
                onPress={() => update({ topic: t.id })}
                style={({ pressed }) => [styles.tile, { backgroundColor: TONE[t.tone].bg }, pressed && { opacity: 0.85 }]}
              >
                <Txt weight={700} color={TONE[t.tone].ink}>
                  {t.title[locale]}
                </Txt>
                <View style={styles.tileFoot}>
                  <Txt variant="label" color={TONE[t.tone].ink} numberOfLines={1} style={styles.tileCount}>
                    {c.explore.sets(count)}
                  </Txt>
                  <Icon name={t.icon as IconName} size="md" color={TONE[t.tone].ink} style={styles.tileIcon} />
                </View>
              </Pressable>
            ))}
          </View>
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
        {/* With nothing searched, the learner's own sets and Community follow the course. */}
        {tiles && <PhraseShelves />}
      </ScrollView>
    </View>
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
    <View style={styles.result}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={c.phrase.play(phrase.target)}
        onPress={() => nav.playPhraseInSet(phrase.id)}
        style={({ pressed }) => [styles.resultMain, pressed && styles.pressed]}
      >
        <Txt variant="row" face="serif" italic weight={500} lang={phrase.targetLang} numberOfLines={1}>
          <Highlight text={phrase.target} words={words} />
        </Txt>
        <Txt variant="label" color="secondary">
          <Txt variant="label" color="secondary" lang={prompt.lang}>
            <Highlight text={prompt.text} words={words} />
          </Txt>
          <Txt variant="label" color="onSurfaceVariant">{` · ${status}`}</Txt>
        </Txt>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={c.phrase.details(phrase.target)} onPress={() => nav.showDetails(phrase.id)} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <Icon name="more_vert" color="secondary" />
      </Pressable>
    </View>
  );
}

/** A filter that is on, as a chip that removes it. */
function RemovableChip({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.chipTarget, pressed && { opacity: 0.8 }]}>
      <View style={styles.removable}>
        <Txt weight={600} color="inverseOnSurface" numberOfLines={1}>
          {label}
        </Txt>
        <Icon name="close" size="sm" color="inverseOnSurface" />
      </View>
    </Pressable>
  );
}

/** One kind of filter inside the chip line, named for screen readers ("Levels", "Tags"). */
function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityLabel={label} style={styles.chipGroup}>
      {children}
    </View>
  );
}

/** A hairline between two groups in the chip line. */
function Divider() {
  return <View accessible={false} style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { width: '100%', maxWidth: PAGE_MAX, alignSelf: 'center', paddingHorizontal: PAGE_PAD, paddingTop: 16, paddingBottom: 24, gap: 16 },
  search: { justifyContent: 'center', maxWidth: 768 },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  field: {
    ...type.field,
    fontFamily: 'sans-400',
    minHeight: 48,
    paddingLeft: 44,
    paddingRight: 16,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.onSurface,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chipTarget: { minHeight: TARGET, justifyContent: 'center' },
  removable: { minHeight: 36, paddingLeft: 14, paddingRight: 10, borderRadius: radius.full, backgroundColor: colors.inverseSurface, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexShrink: 1, flexBasis: 88, minHeight: 80, borderRadius: radius['2xl'], padding: 12, justifyContent: 'space-between', gap: 4 },
  tileFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  tileCount: { flexShrink: 1, opacity: 0.8 },
  tileIcon: { opacity: 0.8 },
  bleed: { marginHorizontal: -PAGE_PAD },
  chipRow: { paddingHorizontal: PAGE_PAD, gap: 8, alignItems: 'stretch' },
  chipGroup: { flexDirection: 'row', gap: 8 },
  divider: { width: 1, marginVertical: 10, backgroundColor: colors.hairline },
  heading: { marginBottom: 6 },
  empty: { paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  emptyLine: { paddingVertical: 8 },
  list: { marginHorizontal: -8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: CARD_GAP, rowGap: 20 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultMain: { flex: 1, minWidth: 0, minHeight: 56, paddingLeft: 8, paddingVertical: 8, borderRadius: radius['2xl'] },
  pressed: { backgroundColor: colors.surfaceContainer },
  more: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  mark: { backgroundColor: colors.primaryFixed, color: colors.onPrimaryFixed },
});
