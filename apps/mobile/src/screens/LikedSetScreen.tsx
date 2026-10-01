// Every learner's "Liked phrases" set, as a set's page: the course's phrases they hearted, most
// recently liked first, with the real summary, and Play. It is made of their likes (on any device,
// signed in or not), so there is nothing to share, rename or add here; a phrase leaves when unliked.
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase } from '@shared/state/catalog';
import { displayLearner, likedSetView, phraseProgress, setProgress } from '@shared/state/selectors';
import { hrefOf, useShell } from '../nav/Shell';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { PhraseRow } from '../ui/PhraseRow';
import { progressLabel } from '../ui/progressLabel';
import { SetCover } from '../ui/SetCover';
import { Txt } from '../ui/Txt';
import { colors } from '../ui/theme';

export function LikedSetScreen() {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const { tab } = useShell();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const now = useNow(30_000);
  // Ratings still in their undo window count here too.
  const learner = displayLearner(state);
  const set = likedSetView(state.learner, c.library.likedPhrases);
  const ids = set.phraseIds;
  const progress = setProgress(learner, ids, now);
  // Played as the Library's liked list: the player names it, and it plays once through.
  const source = { kind: 'library' as const, view: 'liked' as const };
  const back = () => (router.canGoBack() ? router.back() : router.navigate(hrefOf({ name: tab }) as never));

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Button variant="icon" icon="arrow_back" color="onSurface" accessibilityLabel={c.common.back} onPress={back} />
      </View>
      <View style={styles.hero}>
        <SetCover set={set} px={160} rounded={16} badges={false} />
        <Txt variant="displaySm" face="serif" weight={600} color="onSurface" align="center" accessibilityRole="header" style={styles.title}>
          {set.title}
        </Txt>
        <Txt variant="body" color="secondary" align="center">
          {c.set.summary(progress.total, progress.learned, progress.due)}
        </Txt>
      </View>

      <View style={styles.actions}>
        <Button variant="primary" icon="play_arrow" iconFill label={c.library.playAll(ids.length)} disabled={ids.length === 0} onPress={() => nav.playList(ids, 0, source)} />
      </View>

      <View style={styles.rows}>
        {ids.length === 0 ? (
          <Txt variant="body" color="secondary" style={styles.pad}>
            {c.library.empty.liked}
          </Txt>
        ) : (
          ids.map((id, i) => {
            const phrase = findPhrase(state.learner, id);
            if (!phrase) return null;
            return (
              <PhraseRow
                key={id}
                phrase={phrase}
                detail={progressLabel(c, phraseProgress(learner, id, now), now)}
                onPlay={() => nav.playList(ids, i, source)}
                onMore={() => nav.showDetails(id)}
              />
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  top: { flexDirection: 'row', paddingHorizontal: 8 },
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  title: { marginTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 16 },
  rows: { paddingTop: 20, paddingHorizontal: 12 },
  pad: { paddingHorizontal: 12, paddingVertical: 8 },
});
