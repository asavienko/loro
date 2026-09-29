// Keeps the course's content current (plan 106). The packs saved on the device were installed before
// the first render (app/_layout.tsx); this downloads the learner's course when it opens, when they
// change course, and when they sign in or out (their own and saved sets come with it). With no copy
// of the course at all, the app waits for it, and says so when the server can't be reached.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { forgetPacks, refreshCourse } from '@shared/api/contentCache';
import { onSessionChange, sessionState } from '@shared/api/session';
import { installedPack, LanguageCode } from '@shared/content';
import { useLatest } from '@shared/lib/useLatest';

export type ContentStatus = 'ready' | 'loading' | 'offline';

interface ContentValue {
  /** `ready`: the course is installed (maybe an older copy); otherwise waiting for it. */
  status: ContentStatus;
  /** Downloads the course again now, e.g. after making or sharing a set. */
  refresh: () => Promise<void>;
}

const ContentContext = createContext<ContentValue | null>(null);

/** How long a copy may be before coming back to the foreground downloads it again. */
const STALE_MS = 10 * 60_000;

export function ContentProvider({ targetLang, children }: { targetLang: LanguageCode; children: ReactNode }) {
  // What the last download of a course said; an installed course is ready whatever it said.
  const [failed, setFailed] = useState<LanguageCode | null>(null);
  const status: ContentStatus = installedPack(targetLang) ? 'ready' : failed === targetLang ? 'offline' : 'loading';
  const lastFetch = useRef(0);
  const course = useLatest(targetLang);

  const refresh = useCallback(async () => {
    const lang = course.current;
    try {
      await refreshCourse(lang);
      lastFetch.current = performance.now();
      setFailed(null);
    } catch {
      // Offline: an installed copy keeps working; without one the app waits and says why.
      setFailed(lang);
    }
  }, [course]);

  useEffect(() => {
    void refreshCourse(targetLang).then(
      () => {
        lastFetch.current = performance.now();
        setFailed(null);
      },
      () => setFailed(targetLang),
    );
  }, [targetLang]);

  // Signing in brings the learner's own and saved sets; signing out takes them away.
  useEffect(() => {
    let signedIn = sessionState().status === 'signedIn';
    return onSessionChange((next) => {
      if (next.status === 'loading' || (next.status === 'signedIn') === signedIn) return;
      signedIn = next.status === 'signedIn';
      void (signedIn ? Promise.resolve() : forgetPacks()).then(refresh);
    });
  }, [refresh]);

  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active' && performance.now() - lastFetch.current > STALE_MS) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return <ContentContext.Provider value={{ status, refresh }}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error('useContent must be used inside ContentProvider');
  return value;
}
