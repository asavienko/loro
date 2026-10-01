// The keyboard as it moves (react-native-keyboard-controller, under the KeyboardProvider in
// app/_layout.tsx): how far it stands above the bottom of the screen, and how far open it is. It
// follows the keyboard of a sheet's own window on Android too, which React Native's Keyboard events
// and reanimated's keyboard don't. On the web the keyboard is the browser's: both stay 0.
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

export function useKeyboardLift(): { lift: SharedValue<number>; progress: SharedValue<number> } {
  const { height, progress } = useReanimatedKeyboardAnimation();
  // `height` is the keyboard's travel: negative while it is up.
  const lift = useDerivedValue(() => Math.max(0, -height.get()));
  return { lift, progress };
}
