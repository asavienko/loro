// Touch feedback on iOS and Android, in place of src/shared/ui/haptics.ts (whose exports this
// mirrors; metro.config.js swaps it in). iOS uses its feedback generators; Android asks the view
// for the system's own haptic constants, so the "touch feedback" setting turns them off and no
// vibration permission is needed. A device without haptics simply feels nothing.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const android = Platform.OS === 'android';
/** Toggle, gesture and confirm constants came in Android 11; older phones get a tick. */
const modern = android && typeof Platform.Version === 'number' && Platform.Version >= 30;

const quiet = (feedback: Promise<void>) => void feedback.catch(() => {});
const impact = (style: Haptics.ImpactFeedbackStyle) => quiet(Haptics.impactAsync(style));
// performAndroidHapticsAsync doesn't return its native call, so a rejection there can't be caught:
// only constants this phone has are asked for.
const androidHaptic = (type: Haptics.AndroidHaptics) => quiet(Haptics.performAndroidHapticsAsync(type));

export function tapHaptic(): void {
  if (android) androidHaptic(Haptics.AndroidHaptics.Virtual_Key);
  else impact(Haptics.ImpactFeedbackStyle.Light);
}

export function selectHaptic(): void {
  if (android) androidHaptic(Haptics.AndroidHaptics.Clock_Tick);
  else quiet(Haptics.selectionAsync());
}

export function toggleHaptic(on: boolean): void {
  if (android) androidHaptic(modern ? (on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off) : Haptics.AndroidHaptics.Clock_Tick);
  else quiet(Haptics.selectionAsync());
}

export function thresholdHaptic(): void {
  if (android) androidHaptic(Haptics.AndroidHaptics.Context_Click);
  else impact(Haptics.ImpactFeedbackStyle.Rigid);
}

export function liftHaptic(): void {
  if (android) androidHaptic(Haptics.AndroidHaptics.Long_Press);
  else impact(Haptics.ImpactFeedbackStyle.Medium);
}
