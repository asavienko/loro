// Who is signed in, and what their allowances are today (plan 106). The session itself lives in
// @shared/api/session; this makes it React state and keeps the day's usage at hand for the screens
// that generate, so a spent allowance is shown before the learner asks.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fetchUsage, Usage } from '@shared/api/library';
import { onSessionChange, sessionState, SessionState, signOut } from '@shared/api/session';
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
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => onSessionChange(setSession), []);

  const refreshUsage = useCallback(async () => {
    if (sessionState().status !== 'signedIn') return;
    try {
      setUsage(await fetchUsage());
    } catch {
      // Offline or signed out meanwhile: the last answer stands.
    }
  }, []);

  useEffect(() => {
    if (session.status !== 'signedIn') return;
    fetchUsage().then(setUsage, () => {});
  }, [session.status, session.account?.userId]);

  // Signed out, there is no allowance to show, whatever the last answer was.
  const shown = session.status === 'signedIn' ? usage : null;
  // Signing out saves the learner's progress to their account first (progressSync.ts).
  const signOutSaving = useCallback(async () => {
    await beforeSignOut.run();
    await signOut();
  }, []);
  return <AccountContext.Provider value={{ ...session, usage: shown, refreshUsage, signOut: signOutSaving }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

/** How many of one kind are left today, or null when unknown. */
export function remaining(usage: Usage | null, kind: keyof Usage['daily']): number | null {
  if (!usage) return null;
  const { used, limit } = usage.daily[kind];
  return Math.max(0, limit - used);
}
