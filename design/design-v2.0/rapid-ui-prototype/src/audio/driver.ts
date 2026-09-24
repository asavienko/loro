// Runs the side effects of the state machine's current phase:
//   native → speak the prompt, then a short gap
//   pause  → the "your turn" cue, then silence sized to the measured target
//   target → speak the target, then a short gap
//   rate   → hold briefly for a rating
// Each finished phase is reported as PHASE_DONE with the phase's cycle, so a
// stale completion (after pause/skip) is ignored by the machine.
import { useEffect } from 'react';
import { useLatest } from '../lib/useLatest';
import { findPhrase, promptOf } from '../state/catalog';
import { currentPhraseId, measuredTargetMs } from '../state/selectors';
import { useStore } from '../state/store';
import { GAP_MS, pauseMs, RATE_HOLD_MS } from '../state/timing';
import { turnCue } from './cues';
import { Playback, PlaybackResult, preloadClip, silence, speak } from './speech';

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
  // Read when a phase starts: a new speed or measurement applies from the next
  // phase and must not restart the one in progress.
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
        lang = prompt.lang;
        playback = speakThenGap(speak(prompt.text, prompt.lang, speed, phrase.audio?.[prompt.lang]));
        break;
      case 'pause': {
        turnCue();
        playback = silence(pauseMs(measuredTargetMs(s.learner, phraseId), phrase.target, speed));
        break;
      }
      case 'target':
        playback = speakThenGap(speak(phrase.target, phrase.targetLang, speed, phrase.audio?.[phrase.targetLang]));
        break;
      case 'rate':
        playback = silence(RATE_HOLD_MS);
        break;
    }
    let active = true;
    void playback.done.then((result) => {
      if (!active) return;
      if (result.status === 'failed') {
        actions.phaseDone(cycle, { failedLang: lang });
      } else if (result.status === 'timeout') {
        actions.phaseDone(cycle, { unconfirmed: true });
      } else {
        const spoken = phase === 'native' || phase === 'target';
        actions.phaseDone(cycle, spoken ? { measuredMs: Math.round(result.ms * speed) } : {});
      }
    });
    return () => {
      active = false;
      playback.cancel();
    };
  }, [status, phase, cycle, phraseId, actions, latest]);

  // Recorded clips of the next phrase load while this one plays.
  const nextId = state.player.order[state.player.index + 1];
  useEffect(() => {
    const next = findPhrase(latest.current.learner, nextId);
    for (const url of Object.values(next?.audio ?? {})) if (url) preloadClip(url);
  }, [nextId, latest]);

  // A hidden page (locked screen, another app, a call) pauses cleanly instead of
  // leaving the state "playing" while the browser silences speech.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && latest.current.player.status === 'playing') actions.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [actions, latest]);
}
