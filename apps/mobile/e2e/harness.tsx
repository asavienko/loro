// Launches the whole app in Node for an end-to-end test: the real root layout and routes (app/),
// booted as on a phone — storage read, the course downloaded from the (fake) API, the learner's
// state loaded — and driven through what is on screen. Time is fake and starts at T0, so a phrase's
// pauses, the rating window and a day passing take no real time (`advance`).
//
//   const app = await launch();                       // an onboarded learner, en-GB → es-ES
//   await app.tap(c.home.title);                      // by visible text or accessibility label
//   await app.advance(5_000);                         // five seconds of playback
//   expect(app.saved().learner.log).toHaveLength(…);  // what the phone has saved
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within, type RenderResult } from '@testing-library/react-native';
import path from 'node:path';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { store as routerStore } from 'expo-router/build/global-state/router-store';
import { router } from 'expo-router/build/imperative-api';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { copyForNative, type Copy } from '@shared/copy';
import { resetContent, type LanguageCode } from '@shared/content';
import { initialState } from '@shared/state/initial';
import { parseState, serializeState } from '@shared/state/persistence';
import { STORAGE_KEY } from '@shared/state/storage';
import type { AppState, Prefs } from '@shared/state/types';
import { FakeApi, type User } from './fakes/api';
import { audio } from './fakes/audio';
import { device } from './fakes/device';
import { world } from './world';

export { act, fireEvent, screen, waitFor, within };

/** One element of the rendered tree. */
export type ReactTestInstance = ReturnType<typeof screen.getByText>;

/** A pan gesture as the app builds it: its settings and the callbacks the finger runs. */
interface Pan {
  config: { enabled?: boolean };
  handlers: Partial<Record<'onBegin' | 'onStart' | 'onUpdate' | 'onChange' | 'onEnd' | 'onFinalize', (event: object, success?: boolean) => void>>;
}
export { audio, device };

/** 1 September 2026, 09:00 UTC: every launch's clock starts here unless told otherwise. */
export const T0 = Date.UTC(2026, 8, 1, 9, 0, 0);
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const APP_DIR = path.resolve(__dirname, '../app');

/** The learner's UI copy, to find things by the words the learner sees. */
export const copy = (native: LanguageCode = 'en-GB'): Copy => copyForNative(native);

export interface Learner {
  name?: string;
  nativeLang?: LanguageCode;
  targetLang?: LanguageCode;
  prefs?: Partial<Prefs>;
  /** Any further change to the saved state, e.g. a log of earlier ratings. */
  edit?: (state: AppState) => AppState;
}

export interface LaunchOptions {
  /** 'new': nothing saved (onboarding shows). Otherwise an onboarded learner (default en-GB → es-ES, "Ana"). */
  learner?: 'new' | Learner;
  /** Signed in on this device as this email (the account exists on the server). */
  signedIn?: string;
  /** The route to open, e.g. '/set/set-cafe' or '/shared/abcdefghij'. Default '/'. */
  url?: string;
  /** The server to talk to; a new one by default. Pass `app.api` for a second device or a restart. */
  api?: FakeApi;
  /** Keep this device's storage and secrets as they are (a restart); the default starts it empty. */
  keepDevice?: boolean;
  /** The clock at launch; default T0, or where the last launch's clock is when keeping the device. */
  now?: number;
  /** Wait for the first screen (the default); false returns as soon as the app has rendered. */
  waitForReady?: boolean;
}

export interface App {
  api: FakeApi;
  /** The signed-in account at launch, if any. */
  user: User | null;
  c: Copy;
  result: RenderResult;
  /** The current route, e.g. '/set/set-cafe'. */
  pathname(): string;
  /** Moves the fake clock on by `ms`, running every timer due and the work that follows. */
  advance(ms: number): Promise<void>;
  /**
   * Moves the clock on by `ms` in one jump: every timer due fires, but what they start runs only at
   * the end (a playing loop stalls). For long waits while nothing plays — a day away — where
   * `advance`, timer by timer, would be slow.
   */
  skip(ms: number): Promise<void>;
  /** Lets pending promises, renders and zero-delay timers run. */
  settle(): Promise<void>;
  /** Presses the control whose text or accessibility label is `name` (exact match, or a RegExp). */
  tap(name: string | RegExp, options?: { within?: ReactTestInstance; index?: number }): Promise<void>;
  /** Long-presses the control whose text or accessibility label is `name`. */
  longPress(name: string | RegExp, options?: { within?: ReactTestInstance }): Promise<void>;
  /**
   * Pans the gesture around the element whose text or label is `name` by `dx`/`dy` points and lets
   * go: a swipe, a drag, a sheet pulled down. Where several gestures race, `gesture` picks one (0 first).
   */
  swipe(name: string | RegExp, move: { dx?: number; dy?: number }, options?: { within?: ReactTestInstance; index?: number; gesture?: number }): Promise<void>;
  /** Types into the text field found by placeholder or accessibility label. */
  type(field: string | RegExp, text: string): Promise<void>;
  /** Submits (the keyboard's return key) the field found by placeholder or accessibility label. */
  submit(field: string | RegExp): Promise<void>;
  /** Whether something with this text or label is on screen now. */
  sees(name: string | RegExp): boolean;
  /** Waits (in fake time) until it is on screen. */
  waitFor(name: string | RegExp, timeoutMs?: number): Promise<ReactTestInstance>;
  /** What the phone has saved now, as the app will load it (the debounced save is flushed first). */
  saved(): Promise<AppState>;
  /** Navigates as a link would (a notification, a pasted link). */
  open(href: string): Promise<void>;
  /** Back, as the system back gesture. */
  back(): Promise<void>;
  /** Closes the app (unmount) and opens it again on the same device and server. */
  restart(options?: Omit<LaunchOptions, 'api' | 'keepDevice'>): Promise<App>;
  /** The app going to the background, and coming back. */
  background(): Promise<void>;
  foreground(): Promise<void>;
  unmount(): void;
}

let mounted: RenderResult | null = null;

/** Finds a pressable by its visible text or accessibility label. */
function findByName(name: string | RegExp, root?: ReactTestInstance, index = 0): ReactTestInstance {
  const scope = root ? within(root) : screen;
  const byLabel = scope.queryAllByLabelText(name);
  const byText = scope.queryAllByText(name);
  const all = [...byLabel, ...byText];
  if (all.length === 0) {
    throw new Error(`Nothing on screen is called ${String(name)}.\nOn screen: ${visibleText().slice(0, 1500)}`);
  }
  if (index >= all.length) throw new Error(`Only ${all.length} matches for ${String(name)}, not ${index + 1}`);
  return all[index];
}

/** The texts on screen, for failure messages. */
export function visibleText(): string {
  try {
    const texts = screen.UNSAFE_root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Text');
    return texts
      .map((t: ReactTestInstance) =>
        t.children
          .filter((x: unknown) => typeof x === 'string')
          .join('')
          .trim(),
      )
      .filter(Boolean)
      .join(' | ');
  } catch {
    return '(nothing rendered)';
  }
}

/** A phone's screen, for the views that measure themselves. */
export const SCREEN = { width: 390, height: 844 };
const laidOut = new WeakSet<object>();

/**
 * Gives every view that measures itself (onLayout) a size once, as a phone's layout pass does: the
 * test renderer has no layout, and some of the app's chrome (the grades over the tab bar) appears
 * only once measured.
 */
function layoutAll(): boolean {
  let any = false;
  let root: ReactTestInstance;
  try {
    root = screen.UNSAFE_root;
  } catch {
    return false;
  }
  for (const node of root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && typeof n.props.onLayout === 'function')) {
    if (laidOut.has(node.props.onLayout)) continue;
    laidOut.add(node.props.onLayout);
    any = true;
    const height = typeof node.props.style === 'object' && node.props.style && 'height' in node.props.style ? Number(node.props.style.height) || 64 : 64;
    node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: SCREEN.width, height } } });
  }
  return any;
}

async function flush(): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(0);
      }
    });
    let measured = false;
    await act(async () => {
      measured = layoutAll();
    });
    if (!measured) break;
  }
}

/** Writes an onboarded learner's saved state to the device, as the app would have saved it. */
async function seedLearner(learner: Learner, now: number): Promise<void> {
  const base = initialState('e2edevice', 'e2einstance');
  const state: AppState = {
    ...base,
    learner: {
      ...base.learner,
      profile: {
        ...base.learner.profile,
        name: learner.name ?? 'Ana',
        nativeLang: learner.nativeLang ?? 'en-GB',
        targetLang: learner.targetLang ?? 'es-ES',
        onboarded: true,
        updatedAt: now - DAY,
      },
    },
    prefs: { ...base.prefs, skippedDemo: true, ...learner.prefs },
  };
  const edited = learner.edit ? learner.edit(state) : state;
  await AsyncStorage.setItem(STORAGE_KEY, serializeState(edited));
  await AsyncStorage.setItem('loro.prototype.device', 'e2edevice');
}

/** Signs `email` in on this device as a past sign-in left it: the refresh token and the account kept. */
async function seedSession(api: FakeApi, email: string): Promise<User> {
  const user = api.addUser(email);
  const { refresh_token } = api.issue(user);
  device.secure.set('loro.refresh', refresh_token);
  await AsyncStorage.setItem('loro.account', JSON.stringify({ userId: user.id, email: user.email, provider: user.provider, displayName: user.displayName }));
  return user;
}

export async function launch(options: LaunchOptions = {}): Promise<App> {
  if (mounted) {
    mounted.unmount();
    mounted = null;
  }
  const api = options.api ?? new FakeApi();
  world.api = api;
  const keep = options.keepDevice === true;
  const now = options.now ?? (keep ? Date.now() : T0);
  // Microtasks stay real: React's act() checks with one that it was awaited.
  jest.useFakeTimers({ now, advanceTimers: false, doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  if (!keep) {
    await AsyncStorage.clear();
    device.secure.clear();
    // The device starts without any course: each launch downloads it as a phone's first start does.
    resetContent();
  }
  const learner = options.learner ?? {};
  if (!keep && learner !== 'new') await seedLearner(learner, now);
  const user = options.signedIn ? await seedSession(api, options.signedIn) : null;
  const native = learner !== 'new' ? (learner.nativeLang ?? 'en-GB') : 'en-GB';

  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  const result = render(<ExpoRoot context={getMockContext(APP_DIR)} location={options.url ?? '/'} />);
  mounted = result;

  const app: App = {
    api,
    user,
    c: copy(native),
    result,
    pathname: () => routerStore.getRouteInfo().pathname,
    advance: async (ms) => {
      // Timer by timer, each in its own act(), so the renders and effects one timer causes (the
      // player's next phase) run before the next is due. A marker timer at the end stops it there.
      const end = Date.now() + ms;
      const marker = setTimeout(() => {}, ms);
      // Timers that keep starting each other with no delay would hold the clock still for ever.
      let still = 0;
      while (Date.now() < end) {
        const before = Date.now();
        await act(async () => {
          jest.advanceTimersToNextTimer();
          for (let i = 0; i < 3; i++) await Promise.resolve();
        });
        still = Date.now() === before ? still + 1 : 0;
        if (still > 1000) {
          clearTimeout(marker);
          throw new Error(`advance(${ms}) stalled at +${ms - (end - Date.now())} ms: timers keep starting each other without delay`);
        }
      }
      clearTimeout(marker);
      await flush();
    },
    skip: async (ms) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        for (let i = 0; i < 3; i++) await Promise.resolve();
      });
      await flush();
    },
    settle: flush,
    tap: async (name, opts = {}) => {
      const target = findByName(name, opts.within, opts.index ?? 0);
      await act(async () => {
        fireEvent.press(target);
      });
      await flush();
    },
    longPress: async (name, opts = {}) => {
      const target = findByName(name, opts.within);
      await act(async () => {
        fireEvent(target, 'longPress');
      });
      await flush();
    },
    swipe: async (name, { dx = 0, dy = 0 }, opts = {}) => {
      // The pan as it is in the latest render: each render makes the gesture afresh with its
      // callbacks' current values, as the detector hands them to the native side.
      let last: Pan | null = null;
      const current = (): Pan => {
        const found = [...screen.queryAllByLabelText(name), ...screen.queryAllByText(name)];
        const target = opts.within ? within(opts.within).queryAllByLabelText(name)[opts.index ?? 0] : found[opts.index ?? 0];
        let node: ReactTestInstance | null = target ?? null;
        while (node && node.type !== GestureDetector) node = node.parent;
        if (!node) {
          if (last) return last;
          throw new Error(`${String(name)} has no gesture around it.\nOn screen: ${visibleText().slice(0, 1500)}`);
        }
        const gesture = node.props.gesture as Pan & { gestures?: Pan[] };
        const pans = gesture.gestures ?? [gesture];
        const pan = pans[opts.gesture ?? 0];
        if (!pan) throw new Error(`${String(name)} has ${pans.length} gestures, not ${(opts.gesture ?? 0) + 1}`);
        last = pan;
        return pan;
      };
      if (current().config.enabled === false) return;
      // A finger: down, then moving a quarter of the way at a time, one frame (16 ms) apart, each
      // frame's work done before the next, and let go where it got to.
      const at = (f: number, prev: number) => ({
        translationX: dx * f,
        translationY: dy * f,
        changeX: dx * (f - prev),
        changeY: dy * (f - prev),
        x: dx * f,
        y: dy * f,
        absoluteX: dx * f,
        absoluteY: dy * f,
        velocityX: dx * 4,
        velocityY: dy * 4,
        numberOfPointers: 1,
        state: State.ACTIVE,
      });
      const frame = async (run: (pan: Pan) => void) => {
        await act(async () => {
          run(current());
          jest.advanceTimersByTime(16);
          for (let i = 0; i < 3; i++) await Promise.resolve();
        });
      };
      await frame((pan) => pan.handlers.onBegin?.({ ...at(0, 0), state: State.BEGAN }));
      await frame((pan) => pan.handlers.onStart?.(at(0.25, 0)));
      for (const [f, prev] of [
        [0.25, 0],
        [0.5, 0.25],
        [0.75, 0.5],
        [1, 0.75],
      ]) {
        await frame((pan) => {
          pan.handlers.onUpdate?.(at(f, prev));
          pan.handlers.onChange?.(at(f, prev));
        });
      }
      await frame((pan) => pan.handlers.onEnd?.({ ...at(1, 1), state: State.END }, true));
      await frame((pan) => pan.handlers.onFinalize?.({ ...at(1, 1), state: State.END }, true));
      await flush();
    },
    type: async (field, text) => {
      const input = screen.queryAllByPlaceholderText(field)[0] ?? screen.getByLabelText(field);
      await act(async () => {
        fireEvent.changeText(input, text);
      });
      await flush();
    },
    submit: async (field) => {
      const input = screen.queryAllByPlaceholderText(field)[0] ?? screen.getByLabelText(field);
      await act(async () => {
        fireEvent(input, 'submitEditing', { nativeEvent: { text: input.props.value } });
      });
      await flush();
    },
    sees: (name) => screen.queryAllByText(name).length > 0 || screen.queryAllByLabelText(name).length > 0,
    waitFor: (name, timeoutMs = 10_000) =>
      waitFor(
        () => {
          const found = [...screen.queryAllByText(name), ...screen.queryAllByLabelText(name)];
          if (found.length === 0) throw new Error(`Never saw ${String(name)}.\nOn screen: ${visibleText().slice(0, 1500)}`);
          return found[0];
        },
        { timeout: timeoutMs },
      ),
    saved: async () => {
      await app.advance(500);
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (!json) throw new Error('Nothing saved yet');
      const state = parseState(json, { id: 'e2edevice', instance: 'e2einstance', seq: 0 });
      if (!state) throw new Error('The saved state could not be read');
      return state;
    },
    open: async (href) => {
      await act(async () => router.navigate(href as never));
      await flush();
    },
    back: async () => {
      await act(async () => router.back());
      await flush();
    },
    restart: async (more = {}) => {
      await app.advance(500);
      return launch({ ...more, api, keepDevice: true, signedIn: undefined, learner: undefined });
    },
    background: async () => {
      await act(async () => setAppState('background'));
      await flush();
    },
    foreground: async () => {
      await act(async () => setAppState('active'));
      await flush();
    },
    unmount: () => {
      result.unmount();
      mounted = null;
    },
  };

  await flush();
  if (options.waitForReady !== false) {
    await waitFor(() => {
      if (visibleText() === '' || visibleText() === '(nothing rendered)') throw new Error('Still booting');
    });
    await flush();
  }
  return app;
}

/** Tells the app's AppState listeners the app moved to `next`, as React Native does. */
function setAppState(next: 'active' | 'background' | 'inactive'): void {
  const { AppState } = require('react-native');
  AppState.currentState = next;
  const emitter = (AppState as { _emitter?: { emit: (event: string, value: string) => void } })._emitter;
  if (emitter) emitter.emit('appStateDidChange', { app_state: next } as never);
  for (const listener of appStateListeners) listener(next);
}

const appStateListeners = new Set<(state: string) => void>();
beforeAll(() => {
  const { AppState } = require('react-native');
  const original = AppState.addEventListener.bind(AppState);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, listener: (state: string) => void) => {
    if (type !== 'change') return original(type, listener);
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  }) as never);
  AppState.currentState = 'active';
});

afterEach(() => {
  if (mounted) {
    mounted.unmount();
    mounted = null;
  }
  appStateListeners.clear();
});
