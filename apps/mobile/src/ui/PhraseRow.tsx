import { StyleSheet, View } from 'react-native';
import { languageName } from '@shared/copy';
import type { Phrase } from '@shared/content';
import { promptOf } from '@shared/state/catalog';
import { useCopy, useStore } from '../state/store';
import { Icon } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';
import { colors, radius, TARGET } from './theme';

interface PhraseRowProps {
  phrase: Phrase;
  /** The real progress label, after the prompt. */
  detail?: string;
  leading?: string;
  isCurrent?: boolean;
  isPlaying?: boolean;
  /** Recall rule: while the learner is recalling it, show the prompt, not the answer. */
  hideTarget?: boolean;
  onPlay: () => void;
  playLabel?: string;
  onMore: () => void;
}

/** A two-line track row (the web's src/ui/PhraseRow.tsx): the target, then the prompt · status. */
export function PhraseRow({ phrase, detail, leading, isCurrent = false, isPlaying = false, hideTarget = false, onPlay, playLabel, onMore }: PhraseRowProps) {
  const c = useCopy();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const title = hideTarget ? prompt.text : phrase.target;
  const status = [detail, phrase.own && c.phrase.yoursShort].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, isCurrent && styles.current]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={playLabel ?? c.phrase.play(title)}
        accessibilityState={{ selected: isCurrent }}
        onPress={onPlay}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {leading !== undefined && (
          <View style={styles.leading}>
            {isPlaying ? <Icon name="volume_up" size="sm" color="primaryContainer" /> : <Txt variant="label" weight={700} color="secondary">{leading}</Txt>}
          </View>
        )}
        <View style={styles.text}>
          <Txt
            variant="row"
            face={hideTarget ? 'sans' : 'serif'}
            italic={!hideTarget}
            weight={isCurrent ? 600 : 500}
            color={isCurrent ? 'primaryContainer' : 'onSurface'}
            lang={hideTarget ? prompt.lang : phrase.targetLang}
          >
            {title}
          </Txt>
          <Txt variant="label" color="secondary">
            {hideTarget ? c.player.hidden(languageName(phrase.targetLang, c.locale)) : <Txt variant="label" color="secondary" lang={prompt.lang}>{prompt.text}</Txt>}
            {status ? <Txt variant="label" color="onSurfaceVariant">{` · ${status}`}</Txt> : null}
          </Txt>
        </View>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel={c.phrase.details(title)} onPress={onMore} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <Icon name="more_vert" color="secondary" />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius['2xl'] },
  current: { backgroundColor: 'rgba(255,219,207,0.4)' },
  main: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingVertical: 8, borderRadius: radius['2xl'] },
  pressed: { backgroundColor: colors.surfaceContainer },
  leading: { width: 24, alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
  more: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
