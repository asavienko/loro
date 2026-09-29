// While the course's content is on its way (plan 106): the first launch downloads it, and without a
// connection the app says so plainly and offers to try again. Once one copy is installed the app
// opens offline and this never shows.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ContentStatus } from '../state/content';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors } from '../ui/theme';

export function ConnectionScreen({ status, onRetry }: { status: ContentStatus; onRetry: () => void }) {
  const c = useCopy();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      {status === 'loading' ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primaryContainer} size="large" />
          <Txt variant="row" color="secondary" align="center">
            {c.connection.loading}
          </Txt>
        </View>
      ) : (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Icon name="cloud_off" size="3xl" color="secondary" />
          <Txt variant="displaySm" face="serif" weight={600} align="center" accessibilityRole="header">
            {c.connection.offlineTitle}
          </Txt>
          <Txt variant="row" color="secondary" align="center" style={styles.body}>
            {c.connection.offlineBody}
          </Txt>
          <Button variant="primary" icon="refresh" label={c.connection.retry} onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, maxWidth: 420, alignSelf: 'center' },
  body: { marginBottom: 8 },
});
