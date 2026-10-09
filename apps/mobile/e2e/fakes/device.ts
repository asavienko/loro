// The phone around the app, faked: its dialogs, share sheet, links, notifications, secure store and
// the provider sign-in page. e2e/setup.ts installs these in place of the native modules; tests read
// and steer them through `device`.
import { act } from '@testing-library/react-native';

export interface Dialog {
  title: string;
  message: string;
  buttons: { text?: string; style?: string; onPress?: () => void }[];
}

export interface Scheduled {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export const device = {
  /** Alerts the app showed, still open; answer one with `answer`. */
  dialogs: [] as Dialog[],
  /** What the share sheet was given. */
  shared: [] as { message?: string; url?: string; title?: string }[],
  /** URLs opened outside the app. */
  opened: [] as string[],
  /** Local notifications scheduled. */
  notifications: [] as Scheduled[],
  /** Whether the learner allows notifications. */
  notificationsAllowed: true,
  /** The tap handler the app registered for notifications, to tap one. */
  notificationListeners: new Set<(response: unknown) => void>(),
  /** The Keychain / Keystore. */
  secure: new Map<string, string>(),
  /** What the provider's sign-in page does next: sign in as `email`, or be closed. */
  authSession: { email: 'learner@gmail.test' as string | null },
  /** The pages the auth session was opened on. */
  authPages: [] as string[],
  reset() {
    this.dialogs = [];
    this.shared = [];
    this.opened = [];
    this.notifications = [];
    this.notificationsAllowed = true;
    this.notificationListeners.clear();
    this.secure.clear();
    this.authSession = { email: 'learner@gmail.test' };
    this.authPages = [];
  },
  /** Presses `button` on the open dialog (the newest); throws when none is open or it has no such button. */
  answer(button: string): void {
    const dialog = this.dialogs.pop();
    if (!dialog) throw new Error(`No dialog is open to press "${button}"`);
    const found = dialog.buttons.find((b) => b.text === button);
    if (!found) throw new Error(`The dialog "${dialog.message}" has no "${button}" button; it has ${dialog.buttons.map((b) => `"${b.text}"`).join(', ')}`);
    act(() => found.onPress?.());
  },
  /** Taps a notification the app showed (or one the server pushed), as the system delivers the tap. */
  tapNotification(data: Record<string, unknown>, id = `notification-${Math.random()}`): void {
    const response = { notification: { request: { identifier: id, content: { data } } }, actionIdentifier: 'default' };
    act(() => {
      for (const listener of this.notificationListeners) listener(response);
    });
  },
};
