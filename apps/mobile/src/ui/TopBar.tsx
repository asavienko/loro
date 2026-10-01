import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { languageName } from '@shared/copy';
import { getLanguage } from '@shared/content';
import { points as pointsOf } from '@shared/state/selectors';
import { useCopy, useStore } from '../state/store';
import { Icon } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';
import { useRoom } from './useRoom';

/**
 * The top bar (the web's src/ui/NavigationHeader.tsx): the avatar that opens Settings (or Back on
 * a sub-page), the page title, a page's own action, and the learner's points.
 */
export function TopBar({ title, titleLang, onBack, onOpenSettings, action }: { title?: string; titleLang?: string; onBack?: () => void; onOpenSettings: () => void; action?: ReactNode }) {
  const c = useCopy();
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const { compact } = useRoom();
  const points = pointsOf(state.learner);
  const { name, targetLang } = state.learner.profile;
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {onBack ? (
          <Press accessibilityRole="button" accessibilityLabel={c.common.back} onPress={onBack} style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
            <Icon name="arrow_back" size="lg" />
          </Press>
        ) : (
          <Press
            accessibilityRole="button"
            accessibilityLabel={c.nav.settings(name)}
            accessibilityHint={c.nav.learning(languageName(targetLang, c.locale))}
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              {name ? (
                <Txt variant="body" face="serif" weight={600} color="onPrimary">
                  {name.charAt(0).toLocaleUpperCase()}
                </Txt>
              ) : (
                <Icon name="person" size="md" color="onPrimary" />
              )}
              <View style={styles.flag}>
                <Txt variant="caption" style={styles.flagText}>
                  {getLanguage(targetLang).flag}
                </Txt>
              </View>
            </View>
          </Press>
        )}
        <View style={styles.title}>
          {title && (
            <Txt
              variant="heading"
              face="serif"
              weight={titleLang ? 500 : 600}
              italic={Boolean(titleLang)}
              lang={titleLang}
              numberOfLines={titleLang ? 2 : 1}
              // A page's name shrinks a little on a narrow screen rather than losing its end.
              adjustsFontSizeToFit={!titleLang}
              minimumFontScale={0.8}
              accessibilityRole="header"
            >
              {title}
            </Txt>
          )}
        </View>
        {action}
        {!onBack && (
          <View accessible accessibilityLabel={c.nav.points(points)} style={styles.points} testID="points">
            <Icon name="stars" fill size="xs" color="primaryContainer" />
            <Txt variant="body" weight={700} color="onPrimaryFixed">
              {new Intl.NumberFormat(c.locale).format(points)}
            </Txt>
            {/* On a compact screen the star says it; the label still names the points. */}
            {!compact && (
              <Txt variant="label" weight={500} color="secondary">
                {c.nav.pointsShort(points)}
              </Txt>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
  row: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 1024, alignSelf: 'center' },
  icon: { width: TARGET, height: TARGET, marginLeft: -6, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceContainer },
  avatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  flag: { position: 'absolute', right: -6, bottom: -4, width: 16, height: 16, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  flagText: { fontSize: 10, lineHeight: 12 },
  title: { flex: 1, minWidth: 0 },
  points: { height: 32, paddingHorizontal: 10, marginRight: -4, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: 4 },
});
