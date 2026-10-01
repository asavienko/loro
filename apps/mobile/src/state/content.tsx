// Keeps the course's content current (plan 106). The packs saved on the device were installed before
// the first render (app/_layout.tsx); this downloads the learner's course when it opens, when they
// change course, and when they sign in or out (their own and saved sets come with it). With no copy
// of the course at all, the app waits for it, and says so when the server can't be reached.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { forgetAccountContent, refreshCourse } from '@shared/api/contentCache';
import { onSessionChange, sessionState } from '@shared/api/session';
import { installedPack, LanguageCode } from '@shared/content';
import { useLatest } from '@shared/lib/useLatest';

export type ContentStatus = 'ready' | 'loading' | 'offline';

interface ContentValue {
  /** `ready`: the course is installed (maybe an older copy); otherwise waiting for it. */
  status: ContentStatus;
  /** Downloads the course again now, e.g. after making or sharing a set. */
  refresh: (fresh?: boolean) => Promise<void>;
  /** "Try again": as `refresh`, showing the wait again rather than the failure. */
  retry: () => Promise<void>;
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
  /** Downloads the course; `fresh` doesn't join a download started under another session. */
  const refresh = useCallback(
    async (fresh?: boolean) => {
      const lang = course.current;
      try {
        await refreshCourse(lang, fresh === true);
        lastFetch.current = performance.now();
        setFailed(null);
      } catch {
        // Offline: an installed copy keeps working; without one the app waits and says why.
        setFailed(lang);
      }
    },
    [course],
  );
  // The learner asked: show that it is trying again (a download already on its way is joined).
  const retry = useCallback(() => {
    setFailed(null);
    return refresh();
  }, [refresh]);

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
      void (signedIn ? Promise.resolve() : forgetAccountContent()).then(() => refresh(true));
    });
  }, [refresh]);

  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active' && performance.now() - lastFetch.current > STALE_MS) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return <ContentContext.Provider value={{ status, refresh, retry }}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error('useContent must be used inside ContentProvider');
  return value;
}
