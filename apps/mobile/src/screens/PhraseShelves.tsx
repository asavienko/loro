// The Phrases tab's own part of the library (plan 106): making a set with AI, the learner's sets in
// their account, the sets they saved, and what others have shared in this course. A Community set
// opens like any other; its phrases stay on the device once it is opened, so progress on them keeps.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { unreachable } from '@shared/api/client';
import { keepOpenedSet } from '@shared/api/contentCache';
import { fetchCommunitySets, type CommunitySort } from '@shared/api/library';
import { librarySets, PhraseSet, PhraseWire } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { Icon } from '../ui/Icon';
import { SetCover } from '../ui/SetCover';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function PhraseShelves() {
  const c = useCopy();
  const { state } = useStore();
  const target = state.learner.profile.targetLang;
  const library = librarySets(target);
  const mine = library.filter((s) => s.owner === 'me');
  const saved = library.filter((s) => s.owner !== 'me');

  return (
    <View style={styles.stack}>
      {mine.length > 0 && <Shelf title={c.phrasesTab.yourSets} sets={mine} />}
      {saved.length > 0 && <Shelf title={c.phrasesTab.savedSets} sets={saved} />}
      <Community />
    </View>
  );
}

/** Making a set with AI, at the top of Phrases; signed out, the way to sign in. */
export function MakeSetButton() {
  const c = useCopy();
  const nav = useNav();
  const account = useAccount();
  return (
    <Button
      variant="tonal"
      icon="auto_awesome"
      label={account.status === 'signedIn' ? c.phrasesTab.makeSet : c.phrasesTab.signInToMake}
      onPress={() => (account.status === 'signedIn' ? nav.makeSet() : nav.openAccount())}
      style={styles.make}
    />
  );
}

function Shelf({ title, sets, onOpen }: { title: string; sets: PhraseSet[]; onOpen?: (set: PhraseSet) => void }) {
  const nav = useNav();
  return (
    <View style={styles.shelf}>
      <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
        {title}
      </Txt>
      {sets.map((set) => (
        <SetLine key={set.id} set={set} onPress={() => (onOpen ? onOpen(set) : nav.openSet(set.id))} />
      ))}
    </View>
  );
}

export function SetLine({ set, onPress }: { set: PhraseSet; onPress: () => void }) {
  const c = useCopy();
  const by = set.owner === 'me' ? c.share[set.visibility] : set.author ? c.share.by(set.author) : c.share.byLearner;
  const byline = set.savedBy ? `${by} · ${c.community.savedBy(set.savedBy)}` : by;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${set.title}, ${c.common.phrases(set.phraseIds.length)}, ${byline}`} onPress={onPress} style={({ pressed }) => [styles.line, pressed && styles.pressed]}>
      <SetCover set={set} px={56} rounded={12} />
      <View style={styles.lineText}>
        <Txt variant="row" weight={600} numberOfLines={1} lang={set.targetLang}>
          {set.title}
        </Txt>
        <Txt variant="label" color="secondary" numberOfLines={1}>
          {`${c.common.phrases(set.phraseIds.length)} · ${byline}`}
        </Txt>
        {set.description && (
          <Txt variant="label" color="secondary" numberOfLines={1}>
            {set.description}
          </Txt>
        )}
      </View>
      <Icon name="chevron_right" color="secondary" />
    </Pressable>
  );
}

function Community() {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const target = state.learner.profile.targetLang;
  const [query, setQuery] = useState('');
  // The search last sent and the order: both kept across visits to the tab.
  const [searched, setSearched] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');
  const [found, setFound] = useState<{ sets: PhraseSet[]; phrases: PhraseWire[] } | null>(null);
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchCommunitySets(target, searched, sort).then(
        (reply) => {
          if (!live) return;
          setFound({ sets: reply.sets.filter((s) => s.owner !== 'me'), phrases: reply.phrases });
          setOffline(false);
        },
        (error: unknown) => live && setOffline(unreachable(error)),
      );
      return () => {
        live = false;
      };
    }, [target, searched, sort]),
  );

  const search = () => {
    const next = query.trim();
    if (next === searched) return;
    setFound(null);
    setSearched(next);
  };
  const order = (next: CommunitySort) => {
    if (next === sort) return;
    setFound(null);
    setSort(next);
  };

  const open = (set: PhraseSet) => {
    if (!found) return;
    void keepOpenedSet({ set, phrases: found.phrases.filter((p) => p.setId === set.id) }).then(() => nav.openSet(set.id));
  };

  return (
    <View style={styles.shelf}>
      <View style={styles.communityHead}>
        <Icon name="groups" color="primaryContainer" />
        <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
          {c.community.title}
        </Txt>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={search}
        onBlur={search}
        accessibilityLabel={c.community.search}
        placeholder={c.community.search}
        placeholderTextColor={placeholderColor}
        returnKeyType="search"
        style={field}
      />
      <View style={styles.sort} accessibilityRole="radiogroup" accessibilityLabel={c.community.sortLabel}>
        <Chip label={c.community.sortNew} selected={sort === 'new'} onPress={() => order('new')} />
        <Chip label={c.community.sortPopular} selected={sort === 'popular'} onPress={() => order('popular')} />
      </View>
      {offline ? (
        <Txt color="secondary">{c.community.offline}</Txt>
      ) : found === null ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : found.sets.length === 0 ? (
        <Txt color="secondary">{searched ? c.community.noSetsFound(searched) : c.community.emptySets}</Txt>
      ) : (
        found.sets.map((set) => <SetLine key={set.id} set={set} onPress={() => open(set)} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24, paddingTop: 8 },
  make: { alignSelf: 'flex-start' },
  shelf: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TARGET + 20, paddingVertical: 4, borderRadius: radius.xl },
  lineText: { flex: 1, gap: 1 },
  pressed: { backgroundColor: colors.surfaceContainer },
  communityHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sort: { flexDirection: 'row', gap: 8 },
});
