// The Create tab (plan 106): where the learner makes things with AI. A set of phrases and a song from
// a set, each a title and one line, with today's allowance and who makes it in small print; below,
// what they have made. Signed out, it says what signing in gives and leads there. Covers are drawn
// from an item's own artwork, not from here.
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { albumsForCourse, librarySets } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCover } from '../music/AlbumCover';
import { remaining, useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Icon, IconName } from '../ui/Icon';
import { resetTime } from '../ui/problems';
import { SetCover } from '../ui/SetCover';
import { TopBar } from '../ui/TopBar';
import { Txt } from '../ui/Txt';
import { colors, radius, shadow } from '../ui/theme';

export function CreateScreen() {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const account = useAccount();
  const target = state.learner.profile.targetLang;
  const signedIn = account.status === 'signedIn';
  const usage = account.usage;
  const mySets = librarySets(target).filter((s) => s.owner === 'me');
  const myAlbums = albumsForCourse(target).filter((a) => a.owner === 'me');

  useFocusEffect(
    useCallback(() => {
      void account.refreshUsage();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account.status]),
  );

  /** A card's small print: what's left today, then who makes it on this server. */
  const meta = (kind: 'phrases' | 'song', source: keyof typeof c.create.source | undefined) => {
    const n = remaining(usage, kind);
    const left = n === null ? null : n === 0 ? c.create.none : c.create.left(n);
    return [left, source && c.create.source[source]].filter(Boolean).join(' · ') || undefined;
  };

  return (
    <View style={styles.page}>
      <TopBar title={c.create.title} onOpenSettings={nav.openSettings} />
      <ScrollView contentContainerStyle={styles.content}>
        {!signedIn && (
          <Banner icon="account_circle" action={<Button variant="primarySm" label={c.account.signIn} onPress={nav.openAccount} />} style={styles.signIn}>
            <Txt variant="row">{c.account.needed}</Txt>
          </Banner>
        )}

        <View style={styles.cards}>
          <Card
            icon="auto_awesome"
            title={c.create.phrasesTitle}
            body={c.create.phrasesBody}
            meta={meta('phrases', usage?.writers.phrases)}
            tone="phrases"
            onPress={() => (signedIn ? nav.makeSet() : nav.openAccount())}
          />
          <Card icon="music_note" title={c.create.songTitle} body={c.create.songBody} meta={meta('song', usage?.writers.music)} tone="music" onPress={() => nav.makeSong()} />
          {usage && (
            <Txt variant="caption" color="outline" style={styles.resets}>
              {c.account.resets(resetTime(c.locale, usage.resetsAt))}
            </Txt>
          )}
        </View>

        {mySets.length > 0 && (
          <View style={styles.section}>
            <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
              {c.phrasesTab.yourSets}
            </Txt>
            {mySets.map((set) => (
              <Pressable key={set.id} accessibilityRole="button" onPress={() => nav.openSet(set.id)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                <SetCover set={set} px={48} rounded={10} />
                <View style={{ flex: 1 }}>
                  <Txt variant="row" weight={600} numberOfLines={1}>
                    {set.title}
                  </Txt>
                  <Txt variant="label" color="secondary">
                    {`${c.common.phrases(set.phraseIds.length)} · ${c.share[set.visibility]}`}
                  </Txt>
                </View>
                <Icon name="chevron_right" color="secondary" />
              </Pressable>
            ))}
          </View>
        )}
        {myAlbums.length > 0 && (
          <View style={styles.section}>
            <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
              {c.music.yours}
            </Txt>
            {myAlbums.map((album) => (
              <Pressable key={album.id} accessibilityRole="button" onPress={() => nav.openAlbum(album.id)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                <AlbumCover url={album.coverUrl} px={48} rounded={10} />
                <View style={{ flex: 1 }}>
                  <Txt variant="row" weight={600} numberOfLines={1}>
                    {album.title}
                  </Txt>
                  <Txt variant="label" color="secondary">
                    {`${c.music.songs(album.songCount)} · ${c.share[album.visibility]}`}
                  </Txt>
                </View>
                <Icon name="chevron_right" color="secondary" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * One kind of thing to make; a song's card is told apart by its music icon (plan 107). The icon sits
 * beside the title, so the line under it has the card's whole width (F-08); the small print says
 * what's left today and who makes it, quieter than the line.
 */
function Card({ icon, title, body, meta, tone, onPress }: { icon: IconName; title: string; body: string; meta?: string; tone: 'phrases' | 'music'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, body, meta].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, tone === 'phrases' ? styles.cardIconPhrases : styles.cardIconMusic]}>
          <Icon name={icon} size="md" color={tone === 'music' ? 'onTertiaryFixed' : 'primaryContainer'} />
        </View>
        <Txt variant="title" face="serif" weight={600} style={styles.flex}>
          {title}
        </Txt>
        <Icon name="chevron_right" color="secondary" />
      </View>
      <View style={styles.cardText}>
        <Txt variant="body" color="onSurfaceVariant">
          {body}
        </Txt>
        {meta && (
          <Txt variant="label" color="secondary">
            {meta}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  signIn: { backgroundColor: colors.primaryFixed },
  flex: { flex: 1, minWidth: 0 },
  cards: { gap: 12 },
  card: { gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { gap: 6 },
  cardIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  cardIconPhrases: { backgroundColor: colors.primaryFixed },
  cardIconMusic: { backgroundColor: colors.tertiaryFixed },
  pressed: { opacity: 0.85 },
  resets: { paddingHorizontal: 4 },
  section: { gap: 6, paddingTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderRadius: radius.xl },
});
