// Bottom sheets (the web prototype's src/ui/Sheet.tsx): a title, Close, and a scrolling body. They
// close on the backdrop, Close, and the Android back button.
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';

export function Sheet({ open, title, onClose, children, scroll = true }: { open: boolean; title: string; onClose: () => void; children: ReactNode; scroll?: boolean }) {
  const c = useCopy();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        {/* Pointer-only backdrop: Close and the back button close it for everyone else. */}
        <Pressable accessible={false} importantForAccessibility="no" style={styles.backdrop} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Txt variant="title" face="serif" weight={600} numberOfLines={1} accessibilityRole="header" style={styles.title}>
              {title}
            </Txt>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Txt variant="body" weight={600} color="primaryContainer">
                {c.common.close}
              </Txt>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.fixedBody]}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A 48 px row inside a sheet: an action, or with `selected` one choice of several. */
export function SheetOption({
  icon,
  label,
  onPress,
  selected,
  tone = 'default',
  disabled,
  detail,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  detail?: string;
}) {
  const choice = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={choice ? 'radio' : 'button'}
      accessibilityState={choice ? { checked: selected, disabled: Boolean(disabled) } : { disabled: Boolean(disabled) }}
      // react-native-web drops a nested accessibilityState; the flat ARIA form reaches the DOM.
      aria-checked={choice ? selected : undefined}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.option, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon name={icon} color={tone === 'danger' ? 'error' : 'secondary'} />
      <View style={styles.optionText}>
        <Txt variant="row" weight={selected ? 700 : 500} color={tone === 'danger' ? 'error' : 'onSurface'}>
          {label}
        </Txt>
        {detail && (
          <Txt variant="label" color="secondary">
            {detail}
          </Txt>
        )}
      </View>
      {selected && <Icon name="check" size="md" color="primaryContainer" />}
    </Pressable>
  );
}

/** A frequent action as a tonal tile; `pressed` makes it a toggle whose icon fills while on. */
export function SheetAction({ icon, label, onPress, disabled, pressed: on }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <Pressable
      accessibilityRole={on === undefined ? 'button' : 'togglebutton'}
      accessibilityState={on === undefined ? { disabled: Boolean(disabled) } : { checked: on, disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceContainer }, disabled && styles.disabled]}
    >
      <Icon name={icon} fill={on} color={on ? 'primaryContainer' : 'secondary'} />
      <Txt variant="body" weight={600} style={styles.optionText}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function SheetActionGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="body" weight={700} accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  panel: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    ...shadow.float,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  title: { flex: 1 },
  close: { minHeight: TARGET, minWidth: TARGET, paddingHorizontal: 12, marginRight: -8, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceContainer },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 },
  fixedBody: { flexShrink: 1 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: radius.xl },
  optionText: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.5 },
  action: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexBasis: '47%',
    flexGrow: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { marginTop: 12 },
  sectionTitle: { paddingHorizontal: 8, marginBottom: 4 },
});
