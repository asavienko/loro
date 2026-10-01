// Confirmations and undo (the web prototype's src/ui/Toast.tsx): one snackbar at a time above the
// tab bar and mini-player, and announcements for screen readers without showing anything. A sheet is
// a window of its own over the app, so while one is open the snackbar shows inside the topmost sheet
// (useToastLayer) instead of underneath it.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCopy } from '../state/store';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';

interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  also?: ToastAction;
  tone?: 'info' | 'success';
}

interface ToastItem extends ToastOptions {
  id: number;
  text: string;
}

interface ToastApi {
  toast: (text: string, options?: ToastOptions) => void;
  /** Read out without showing anything. */
  announce: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_MS = 4000;
const TOAST_WITH_ACTION_MS = 6000;

/** How far above the bottom toasts sit: over the tab bar and the mini-player. Screens without them set it lower. */
export const ToastOffsetContext = createContext(132);

/** The snackbar showing now and the open sheets, topmost last, that can show it. */
interface Layers {
  item: ToastItem | null;
  top: number | null;
  dismiss: (id: number) => void;
  add: (layer: number) => void;
  remove: (layer: number) => void;
}

const LayersContext = createContext<Layers | null>(null);
let nextLayer = 1;
/** How far above the bottom of a sheet its snackbar sits. */
const SHEET_OFFSET = 16;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const [layers, setLayers] = useState<number[]>([]);
  const nextId = useRef(1);
  const announce = useCallback((text: string) => AccessibilityInfo.announceForAccessibility(text), []);
  const toast = useCallback(
    (text: string, options: ToastOptions = {}) => {
      setItem({ id: nextId.current++, text, ...options });
      announce(options.action ? `${text}. ${options.action.label}` : text);
    },
    [announce],
  );
  // Stable, so a snackbar's timer isn't restarted by every render of the app around it.
  const dismiss = useCallback((id: number) => setItem((current) => (current?.id === id ? null : current)), []);
  const add = useCallback((layer: number) => setLayers((open) => [...open.filter((l) => l !== layer), layer]), []);
  const remove = useCallback((layer: number) => setLayers((open) => open.filter((l) => l !== layer)), []);
  const api = useMemo(() => ({ toast, announce }), [toast, announce]);
  const top = layers.length > 0 ? layers[layers.length - 1] : null;
  const value = useMemo(() => ({ item, top, dismiss, add, remove }), [item, top, dismiss, add, remove]);
  return (
    <ToastContext.Provider value={api}>
      <LayersContext.Provider value={value}>
        {children}
        {item && top === null && <ToastView key={item.id} item={item} dismiss={dismiss} />}
      </LayersContext.Provider>
    </ToastContext.Provider>
  );
}

/** The snackbar for an open sheet to draw in its own window, while it is the topmost one open. */
export function useToastLayer(open: boolean): ReactNode {
  const layers = useContext(LayersContext);
  const [layer] = useState(() => nextLayer++);
  const add = layers?.add;
  const remove = layers?.remove;
  useEffect(() => {
    if (!open || !add || !remove) return;
    add(layer);
    return () => remove(layer);
  }, [open, layer, add, remove]);
  if (!open || !layers?.item || layers.top !== layer) return null;
  return (
    <ToastOffsetContext.Provider value={SHEET_OFFSET}>
      <ToastView key={layers.item.id} item={layers.item} dismiss={layers.dismiss} />
    </ToastOffsetContext.Provider>
  );
}

function ToastView({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const offset = useContext(ToastOffsetContext);
  const onDone = () => dismiss(item.id);
  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), item.action ? TOAST_WITH_ACTION_MS : TOAST_MS);
    return () => clearTimeout(id);
  }, [item, dismiss]);
  const run = (action: ToastAction) => {
    action.run();
    onDone();
  };
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="box-none"
      style={[styles.layer, { bottom: insets.bottom + offset }]}
    >
      <View style={styles.toast}>
        <Txt variant="body" color="inverseOnSurface" style={styles.text}>
          {item.text}
        </Txt>
        <View style={styles.actions}>
          {item.also && (
            <Pressable accessibilityRole="button" onPress={() => run(item.also!)} style={styles.action}>
              <Txt variant="body" weight={700} color="primaryFixedDim">
                {item.also.label}
              </Txt>
            </Pressable>
          )}
          {item.action && (
            <Pressable accessibilityRole="button" onPress={() => run(item.action!)} style={styles.action}>
              <Txt variant="body" weight={700} color="primaryFixedDim">
                {item.action.label}
              </Txt>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={c.common.close} onPress={onDone} style={styles.close}>
            <Icon name="close" size="md" color="inverseOnSurface" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  toast: {
    width: '100%',
    maxWidth: 480,
    minHeight: 48,
    borderRadius: radius['2xl'],
    backgroundColor: colors.inverseSurface,
    paddingLeft: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    ...shadow.float,
  },
  text: { flexGrow: 1, flexShrink: 1, paddingVertical: 12, minWidth: 160 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  action: { minHeight: TARGET, paddingHorizontal: 12, justifyContent: 'center' },
  close: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
});
