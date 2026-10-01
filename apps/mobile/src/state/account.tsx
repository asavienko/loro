// Who is signed in, and what their allowances are today (plan 106). The session itself lives in
// @shared/api/session; this makes it React state and keeps the day's usage at hand for the screens
// that generate, so a spent allowance is shown before the learner asks.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fetchUsage, Usage } from '@shared/api/library';
import { onSessionChange, sessionState, SessionState, signOut } from '@shared/api/session';
import { forgetPush } from './push';
import { beforeSignOut } from './syncHooks';

interface AccountValue extends SessionState {
  /** Today's allowances; null while signed out or before the first answer. */
  usage: Usage | null;
  /** Asks the API again, e.g. after generating something. */
  refreshUsage: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(sessionState);
  // Each answer is kept with the account it was asked for, so another account never sees it.
  const [usage, setUsage] = useState<{ userId: string; usage: Usage } | null>(null);
  useEffect(() => onSessionChange(setSession), []);

  const refreshUsage = useCallback(async () => {
    const { status, account } = sessionState();
    if (status !== 'signedIn' || !account) return;
    try {
      setUsage({ userId: account.userId, usage: await fetchUsage() });
    } catch {
      // Offline or signed out meanwhile: the last answer stands.
    }
  }, []);

  const userId = session.status === 'signedIn' ? (session.account?.userId ?? null) : null;
  useEffect(() => {
    if (!userId) return;
    fetchUsage().then(
      (next) => setUsage({ userId, usage: next }),
      () => {},
    );
  }, [userId]);

  // Signed out, there is no allowance to show, whatever the last answer was.
  const shown = userId && usage?.userId === userId ? usage.usage : null;
  // Signing out saves the learner's progress to their account first (progressSync.ts), and takes
  // this device's push token back (plan 113), while the session can still say so.
  const signOutSaving = useCallback(async () => {
    await beforeSignOut.run();
    await forgetPush();
    await signOut();
  }, []);
  return <AccountContext.Provider value={{ ...session, usage: shown, refreshUsage, signOut: signOutSaving }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

/** How many of one kind are left today, or null when unknown (an older server may not count a kind). */
export function remaining(usage: Usage | null, kind: keyof Usage['daily']): number | null {
  const entry = usage?.daily[kind] as { used: number; limit: number } | undefined;
  if (!entry) return null;
  return Math.max(0, entry.limit - entry.used);
}
