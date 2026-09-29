// Adds phrases to one of your own sets from the set itself (the web prototype's
// src/sheets/PickPhrasesSheet.tsx): the course's phrases, found with the same word matching as
// Explore, each with an Add / Added toggle. A toggle acts at once; Done closes the sheet.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { TOPICS, type Phrase } from '@shared/content';
import { coursePhrases, findSetView, promptOf } from '@shared/state/catalog';
import { matchesWords, queryWords } from '../screens/ExploreScreen';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function PickPhrasesSheet({ setId, onClose }: { setId: string | null; onClose: () => void }) {
  const c = useCopy();
  return (
    <Sheet open={setId !== null} title={c.set.addPhrases} onClose={onClose} scroll={false}>
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
    <>
      {/* The field stays at the top while the list scrolls under it. */}
      <View accessibilityRole="search" style={styles.search}>
        <View style={styles.searchIcon} pointerEvents="none">
          <Icon name="search" color="secondary" />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          accessibilityLabel={c.pickPhrases.search}
          placeholder={c.pickPhrases.search}
          placeholderTextColor={placeholderColor}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.field}
        />
      </View>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {groups.length === 0 ? (
          <Txt color="secondary" style={styles.empty}>
            {c.explore.noPhrases(text.trim())}
          </Txt>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Txt face="serif" weight={600} color="secondary" lang={group.lang} accessibilityRole="header" style={styles.groupTitle}>
                {group.title}
              </Txt>
              {group.phrases.map((p) => {
                const added = inSet.has(p.id);
                const prompt = promptOf(p, learner.profile.nativeLang);
                return (
                  <View key={p.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Txt variant="row" face="serif" italic lang={p.targetLang}>
                        {p.target}
                      </Txt>
                      <Txt variant="label" color="secondary" numberOfLines={1} lang={prompt.lang}>
                        {prompt.text}
                      </Txt>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${added ? c.pickPhrases.added : c.pickPhrases.add} ${p.target}`}
                      accessibilityState={{ selected: added }}
                      aria-pressed={added}
                      onPress={() => (added ? actions.removeFromSet(setId, p.id) : actions.addToSet(setId, [p.id]))}
                      style={({ pressed }) => [styles.toggle, added ? styles.on : styles.off, pressed && !added && styles.offPressed]}
                    >
                      <Icon name={added ? 'check' : 'add'} size="md" color={added ? 'inverseOnSurface' : 'onSurface'} />
                      <Txt weight={600} color={added ? 'inverseOnSurface' : 'onSurface'} numberOfLines={1}>
                        {added ? c.pickPhrases.added : c.pickPhrases.add}
                      </Txt>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <Button variant="tonal" label={c.pickPhrases.done} onPress={onClose} style={styles.done} />
    </>
  );
}

const styles = StyleSheet.create({
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  // Its own sides, not the field's paddingHorizontal: react-native-web lets that win over paddingLeft.
  field: { ...field, paddingHorizontal: undefined, paddingLeft: 44, paddingRight: 16 },
  list: { flexShrink: 1 },
  empty: { paddingVertical: 12 },
  group: { marginTop: 8 },
  groupTitle: { paddingVertical: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowText: { flex: 1, minWidth: 0 },
  toggle: { minHeight: TARGET, minWidth: 88, paddingHorizontal: 12, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 },
  on: { backgroundColor: colors.inverseSurface },
  off: { backgroundColor: colors.surfaceContainerHigh },
  offPressed: { backgroundColor: colors.surfaceContainerHighest },
  done: { marginTop: 8 },
});
