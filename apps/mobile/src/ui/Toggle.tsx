// Every on/off switch in the app: React Native's Switch with touch feedback as it flips
// (src/shared/ui/haptics.ts); the lint keeps Switch itself to this file.
// eslint-disable-next-line no-restricted-imports
import { Switch, SwitchProps } from 'react-native';
import { toggleHaptic } from '@shared/ui/haptics';

export function Toggle({ onValueChange, ...rest }: SwitchProps) {
  return (
    <Switch
      {...rest}
      onValueChange={
        onValueChange
          ? (on) => {
              toggleHaptic(on);
              return onValueChange(on);
            }
          : undefined
      }
    />
  );
}
