// The Create tab (plan 106): where the learner makes things with AI. A set of phrases, a song from a
// set, and covers for both, each with what's left of today's allowance; below, what they have made.
// Signed out, it says what signing in gives and leads there.
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { albumsForCourse, librarySets } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCover } from '../music/AlbumCover';
import { remaining, useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
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

  const left = (kind: 'phrases' | 'song' | 'cover') => {
    const n = remaining(usage, kind);
    return n === null ? undefined : n === 0 ? c.create.none : c.create.left(n);
  };

  return (
    <View style={styles.page}>
      <TopBar title={c.create.title} onOpenSettings={nav.openSettings} />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt variant="row" color="secondary">
          {c.create.intro}
        </Txt>

        {!signedIn && (
          <View style={styles.signIn}>
            <Icon name="account_circle" size="2xl" color="primaryContainer" />
            <Txt variant="row" style={{ flex: 1 }}>
              {c.account.needed}
            </Txt>
            <Button variant="primarySm" label={c.account.signIn} onPress={nav.openAccount} />
          </View>
        )}

        <Card
          icon="auto_awesome"
          title={c.create.phrasesTitle}
          body={c.create.phrasesBody}
          note={left('phrases')}
          writer={usage ? c.account.writer[usage.writers.phrases] : undefined}
          tone="phrases"
          onPress={() => (signedIn ? nav.makeSet() : nav.openAccount())}
        />
        <Card
          icon="music_note"
          title={c.create.songTitle}
          body={c.create.songBody}
          note={left('song')}
          writer={usage ? `${c.account.writer[usage.writers.lyrics]} · ${c.account.writer[usage.writers.music]}` : undefined}
          tone="music"
          onPress={() => nav.makeSong()}
        />
        <Card icon="palette" title={c.create.coverTitle} body={c.create.coverBody} note={left('cover')} writer={usage ? c.account.writer[usage.writers.cover] : undefined} tone="plain" />

        {usage && (
          <Txt variant="label" color="secondary">
            {c.account.resets(resetTime(c.locale, usage.resetsAt))}
          </Txt>
        )}

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

/** One kind of thing to make. Music's card wears the night colours, as everything musical does. */
function Card({ icon, title, body, note, writer, tone, onPress }: { icon: IconName; title: string; body: string; note?: string; writer?: string; tone: 'phrases' | 'music' | 'plain'; onPress?: () => void }) {
  const night = tone === 'music';
  const content = (
    <>
      <View style={[styles.cardIcon, night ? styles.cardIconNight : tone === 'phrases' ? styles.cardIconPhrases : null]}>
        <Icon name={icon} size="xl" color={night ? 'night' : 'primaryContainer'} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="title" face="serif" weight={600} color={night ? 'onNight' : 'onSurface'}>
          {title}
        </Txt>
        <Txt variant="body" color={night ? 'onNightVariant' : 'secondary'}>
          {body}
        </Txt>
        {writer && (
          <Txt variant="label" color={night ? 'onNightVariant' : 'secondary'}>
            {writer}
          </Txt>
        )}
        {note && (
          <Txt variant="label" weight={700} color={night ? 'nightAccent' : 'primaryContainer'}>
            {note}
          </Txt>
        )}
      </View>
      {onPress && <Icon name="chevron_right" color={night ? 'onNight' : 'secondary'} />}
    </>
  );
  const style = [styles.card, night && styles.cardNight];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}${note ? `. ${note}` : ''}`} onPress={onPress} style={({ pressed }) => [...style, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 48, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  signIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius['2xl'], backgroundColor: colors.primaryFixed },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, ...shadow.card },
  cardNight: { backgroundColor: colors.night },
  cardIcon: { width: 52, height: 52, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerHigh },
  cardIconPhrases: { backgroundColor: colors.primaryFixed },
  cardIconNight: { backgroundColor: colors.nightAccent },
  pressed: { opacity: 0.85 },
  section: { gap: 6, paddingTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderRadius: radius.xl },
});
