// Runs the side effects of the state machine's current phase, as the web prototype's driver does
// (its src/audio/driver.ts): prompt, the learner's turn, target, the hold for a rating. Each
// finished phase is reported with its cycle, so a stale completion is ignored. The app going to
// the background pauses cleanly (the web listens for the page hiding).
import { useEffect } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { holdCue, turnCue } from '@shared/audio/cues';
import { Playback, PlaybackResult, preloadClip, silence, speak } from '@shared/audio/speech';
import { useLatest } from '@shared/lib/useLatest';
import { findPhrase, promptOf } from '@shared/state/catalog';
import { currentPhraseId, phaseDurationMs } from '@shared/state/selectors';
import { GAP_MS, RATE_HOLD_MS } from '@shared/state/timing';
import { useStore } from '../state/store';

/** Speech followed by a gap; the gap is not part of the measurement. */
function speakThenGap(play: Playback): Playback {
  let gap: Playback | null = null;
  let cancelled = false;
  const done = play.done.then(async (result): Promise<PlaybackResult> => {
    if (cancelled || result.status === 'failed') return result;
    gap = silence(GAP_MS);
    await gap.done;
    return result;
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      play.cancel();
      gap?.cancel();
    },
  };
}

export function usePlaybackDriver(): void {
  const { state, actions } = useStore();
  const { status, phase, cycle } = state.player;
  const phraseId = currentPhraseId(state.player);
  // Read when a phase starts: a new speed or measurement applies from the next phase.
  const latest = useLatest(state);

  useEffect(() => {
    if (status !== 'playing' || !phraseId) return;
    const s = latest.current;
    const phrase = findPhrase(s.learner, phraseId);
    if (!phrase) return;
    const speed = s.prefs.speed;
    const prompt = promptOf(phrase, s.learner.profile.nativeLang);
    let playback: Playback;
    let lang = phrase.targetLang;
    switch (phase) {
      case 'native':
        // A target with no clip stops the phrase before its prompt: it could never be heard.
        if (!phrase.audio?.[phrase.targetLang]) {
          playback = speak(null, speed);
          break;
        }
        lang = prompt.lang;
        playback = speakThenGap(speak(phrase.audio?.[prompt.lang], speed));
        break;
      case 'pause':
        turnCue();
        playback = silence(s.player.phaseMs ?? phaseDurationMs(s) ?? 0);
        break;
      case 'target':
        playback = speakThenGap(speak(phrase.audio?.[phrase.targetLang], speed));
        break;
      case 'rate':
        holdCue();
        playback = silence(s.player.phaseMs ?? RATE_HOLD_MS);
        break;
    }
    let active = true;
    void playback.done.then((result) => {
      if (!active) return;
      if (result.status === 'failed') {
        actions.phaseDone(cycle, { failure: { lang, reason: result.reason } });
      } else if (result.status === 'timeout') {
        actions.phaseDone(cycle, { unconfirmed: true });
      } else {
        // A clip's length scales with the speed, so any speed measures it.
        const measured = (phase === 'native' || phase === 'target') && result.ms !== null;
        actions.phaseDone(cycle, measured ? { measuredMs: Math.round(result.ms! * speed) } : {});
      }
    });
    return () => {
      active = false;
      playback.cancel();
    };
  }, [status, phase, cycle, phraseId, actions, latest]);

  const nextId = state.player.order[state.player.index + 1];
  useEffect(() => {
    const next = findPhrase(latest.current.learner, nextId);
    if (!next) return;
    // Only the two languages it will be heard in: each clip the server renders costs.
    const prompt = promptOf(next, latest.current.learner.profile.nativeLang).lang;
    for (const lang of new Set([prompt, next.targetLang])) {
      const url = next.audio?.[lang];
      if (url) preloadClip(url);
    }
  }, [nextId, latest]);

  // Another app, a call, the lock screen: pause instead of leaving the state "playing".
  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next !== 'active' && latest.current.player.status === 'playing') actions.pause();
    });
    return () => subscription.remove();
  }, [actions, latest]);
}
