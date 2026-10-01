// Every control in the app is pressed through this: React Native's Pressable with touch feedback
// (src/shared/ui/haptics.ts) as the press lands. A disabled control, or one with nothing to do,
// gives none; the lint keeps Pressable itself to this file.
// eslint-disable-next-line no-restricted-imports
import { AccessibilityRole, GestureResponderEvent, Pressable, PressableProps } from 'react-native';
import { selectHaptic, tapHaptic } from '@shared/ui/haptics';

/**
 * What a press feels like: `tap` acts or opens; `select` changes a choice (a tab, a chip, an
 * option, a like); `none` where something else already answers it (a rating's cue) or there is
 * no control to feel (a sheet's backdrop).
 */
export type PressHaptic = 'tap' | 'select' | 'none';

export interface PressProps extends PressableProps {
  /** By default a choice's role (a tab, a radio, a toggle) ticks, and anything else taps. */
  haptic?: PressHaptic;
}

const CHOICES = new Set<AccessibilityRole>(['tab', 'radio', 'togglebutton', 'checkbox', 'switch']);
const FEEL: Record<PressHaptic, () => void> = { tap: tapHaptic, select: selectHaptic, none: () => {} };

export function Press({ haptic, onPress, ...rest }: PressProps) {
  const feel = FEEL[haptic ?? (rest.accessibilityRole && CHOICES.has(rest.accessibilityRole) ? 'select' : 'tap')];
  const pressed = onPress
    ? (event: GestureResponderEvent) => {
        feel();
        onPress(event);
      }
    : undefined;
  return <Pressable {...rest} onPress={pressed} />;
}
