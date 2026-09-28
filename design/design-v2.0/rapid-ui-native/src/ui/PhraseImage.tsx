// A phrase's picture (plan 105; the web prototype's src/ui/PhraseImage.tsx): its main icon large on
// its topic's colour, up to two more in small discs at the corners, sized by the shorter side so a
// tile, the player's cover and a card's band are one composition. Decorative: the phrase and its
// meaning are text.
import { StyleSheet, View, ViewStyle } from 'react-native';
import type { TopicTone } from '@shared/content';
import { Icon, IconName } from './Icon';
import { TONE } from './SetCover';

export function PhraseImage({ icons, tone = 'secondary', width, height, rounded = 16, style }: { icons: readonly string[]; tone?: TopicTone; width: number; height: number; rounded?: number; style?: ViewStyle }) {
  const [main, ...rest] = icons as readonly IconName[];
  const side = Math.min(width, height);
  const small = side < 96;
  const disc = side * 0.26;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={`phrase-image:${icons.join(' ')}`}
      style={[{ width, height, borderRadius: rounded, backgroundColor: TONE[tone].bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Icon name={main} size={Math.round(side * (small ? 0.6 : 0.46))} color={TONE[tone].ink} style={{ opacity: 0.9 }} />
      {!small &&
        rest.map((icon, i) => (
          <View
            key={icon}
            style={[
              styles.disc,
              { width: disc, height: disc, borderRadius: disc },
              i === 0 ? { left: side * 0.07, top: side * 0.07 } : { right: side * 0.07, bottom: side * 0.07 },
            ]}
          >
            <Icon name={icon} size={Math.round(side * 0.15)} color={TONE[tone].ink} />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', backgroundColor: 'rgba(252,249,244,0.65)', alignItems: 'center', justifyContent: 'center' },
});
