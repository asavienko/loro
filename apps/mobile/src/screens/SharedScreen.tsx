// What a share link opens (plan 106): /shared/<code> on the web, loro://shared/<code> on a phone.
// The code names a set or an album; a set is kept on the device so its phrases play, then the page
// opens as if it had been found in the app. A code that opens nothing says so.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keepOpenedSet } from '@shared/api/contentCache';
import { fetchShared } from '@shared/api/library';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { problemText } from '../ui/problems';
import { Txt } from '../ui/Txt';
import { colors } from '../ui/theme';

export function SharedScreen({ code }: { code: string }) {
  const c = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchShared(code).then(
      async (shared) => {
        if (!live) return;
        if (shared.kind === 'set') {
          await keepOpenedSet(shared);
          router.replace({ pathname: '/set/[id]', params: { id: shared.set.id, from: 'explore' } });
        } else router.replace({ pathname: '/album/[id]', params: { id: shared.album.id, from: 'music' } });
      },
      (error: unknown) => live && setProblem(problemText(c, error)),
    );
    return () => {
      live = false;
    };
  }, [code, router, c]);

  return (
    <View style={[styles.page, { paddingTop: insets.top + 48 }]}>
      {problem ? (
        <>
          <Txt variant="row" align="center">
            {problem}
          </Txt>
          <Button variant="tonal" label={c.tabs.home} icon="home" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primaryContainer} />
          <Txt variant="body" color="secondary" align="center">
            {c.share.opening}
          </Txt>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', gap: 16, paddingHorizontal: 24 },
});
