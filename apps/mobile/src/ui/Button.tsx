import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';
import { colors, ColorName, radius, TARGET } from './theme';

export type ButtonVariant = 'primary' | 'primarySm' | 'tonal' | 'text' | 'icon';

const LOOK: Record<ButtonVariant, { box: ViewStyle; pressed: ViewStyle; text: ColorName; weight: 600 | 700; variant: 'body' | 'row' }> = {
  // Terracotta fill is for play or the one primary action on a screen.
  primary: { box: { minHeight: 48, paddingHorizontal: 20, backgroundColor: colors.primaryContainer }, pressed: { opacity: 0.9 }, text: 'onPrimary', weight: 700, variant: 'row' },
  primarySm: { box: { minHeight: TARGET, paddingHorizontal: 16, backgroundColor: colors.primaryContainer }, pressed: { opacity: 0.9 }, text: 'onPrimary', weight: 700, variant: 'body' },
  tonal: { box: { minHeight: TARGET, paddingHorizontal: 16, backgroundColor: colors.surfaceContainerHigh }, pressed: { backgroundColor: colors.surfaceContainerHighest }, text: 'onSurface', weight: 600, variant: 'body' },
  text: { box: { minHeight: TARGET, paddingHorizontal: 12 }, pressed: { backgroundColor: colors.surfaceContainer }, text: 'primaryContainer', weight: 600, variant: 'body' },
  icon: { box: { width: TARGET, height: TARGET }, pressed: { backgroundColor: colors.surfaceContainer }, text: 'onSurface', weight: 600, variant: 'body' },
};

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: ButtonVariant;
  label?: string;
  icon?: IconName;
  iconFill?: boolean;
  /** Overrides the variant's text and icon colour (an icon button's colour is always given). */
  color?: ColorName;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * The prototype's buttons (its src/ui/button.ts): a pill with an optional icon, at least 44 px each
 * way. An icon-only button must be named with accessibilityLabel.
 */
export function Button({ variant = 'tonal', label, icon, iconFill, color, style, children, disabled, ...rest }: ButtonProps) {
  const look = LOOK[variant];
  const tint = color ?? look.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={variant === 'icon' ? 0 : undefined}
      {...rest}
      style={({ pressed }) => [styles.base, look.box, pressed && look.pressed, disabled && styles.disabled, style]}
    >
      {icon && <Icon name={icon} fill={iconFill} size={variant === 'icon' ? 'lg' : 'md'} color={tint} />}
      {label !== undefined && (
        <Txt variant={look.variant} weight={look.weight} color={tint} numberOfLines={2} align="center">
          {label}
        </Txt>
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disabled: { opacity: 0.4 },
});

/** A 36 px pill inside a 44 px target; selected is ink, never terracotta (which means play). */
export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  toggle = true,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  /** False for a one-tap action (a suggested topic): no selected state is announced. */
  toggle?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={toggle ? { selected, disabled: Boolean(disabled) } : { disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [chip.target, pressed && { opacity: 0.8 }, disabled && styles.disabled]}
    >
      <View style={[chip.pill, selected ? chip.on : chip.off]}>
        <Txt variant="body" weight={600} color={selected ? 'inverseOnSurface' : 'onSurface'} numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  target: { minHeight: TARGET, justifyContent: 'center' },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  on: { backgroundColor: colors.inverseSurface, borderColor: colors.inverseSurface },
  off: { backgroundColor: colors.surfaceContainerLow, borderColor: colors.hairline },
});
