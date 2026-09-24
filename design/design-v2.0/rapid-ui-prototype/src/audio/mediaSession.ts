// Media Session: the phrase on the lock screen, in the notification shade and
// on the OS media overlay, with play/pause and next/previous — including
// headset buttons. The title follows the recall rule: the prompt until the
// target has been heard.
import { useEffect } from 'react';
import { useLatest } from '../lib/useLatest';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { currentPhraseId } from '../state/selectors';
import { useStore } from '../state/store';
import { isTargetRevealed } from '../ui/phase';

export function useMediaSession(): void {
  const { state, actions } = useStore();
  const phraseId = currentPhraseId(state.player);
  const phrase = findPhrase(state.learner, phraseId);
  const revealed = isTargetRevealed(state.player);
  const title = phrase ? (revealed ? phrase.target : promptOf(phrase, state.learner.profile.nativeLang).text) : null;
  const artist = findSetView(state.learner, state.player.setId)?.title ?? 'Loro';

  const handlers = useLatest(actions);

  useEffect(() => {
    const session = mediaSession();
    if (!session) return;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Not every browser supports every action.
      }
    };
    // A hidden page pauses (speech is silenced there), so Play from the lock screen or a
    // headset is remembered and starts when the page is visible again, rather than
    // "playing" into silence and stopping with an error.
    let playWhenVisible = false;
    const whenVisible = (run: () => void) => () => {
      if (document.visibilityState === 'hidden') playWhenVisible = true;
      else run();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !playWhenVisible) return;
      playWhenVisible = false;
      handlers.current.play();
    };
    document.addEventListener('visibilitychange', onVisible);
    set('play', whenVisible(() => handlers.current.play()));
    set('pause', () => {
      playWhenVisible = false;
      handlers.current.pause();
    });
    set('nexttrack', () => handlers.current.next());
    set('previoustrack', () => handlers.current.prev());
    // Many headsets and cars send seek instead of track: back replays this phrase, forward moves on.
    set('seekbackward', whenVisible(() => handlers.current.restart()));
    set('seekforward', () => handlers.current.next());
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekbackward', 'seekforward'] as const) set(action, null);
    };
  }, [handlers]);

  useEffect(() => {
    const session = mediaSession();
    if (!session || typeof MediaMetadata === 'undefined') return;
    session.metadata = title
      ? new MediaMetadata({
          title,
          artist,
          album: 'Loro',
          artwork: [
            { src: `${import.meta.env.BASE_URL}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          ],
        })
      : null;
  }, [title, artist]);

  useEffect(() => {
    const session = mediaSession();
    if (!session) return;
    session.playbackState = state.player.status === 'playing' ? 'playing' : state.player.status === 'paused' ? 'paused' : 'none';
  }, [state.player.status]);
}

function mediaSession(): MediaSession | null {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
}
