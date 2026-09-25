// Runs the side effects of the state machine's current phase:
//   native → speak the prompt, then a short gap
//   pause  → the "your turn" cue, then silence sized to the measured target (player.phaseMs)
//   target → speak the target, then a short gap
//   rate   → a soft note, then hold briefly for a rating
// Each finished phase is reported as PHASE_DONE with the phase's cycle, so a
// stale completion (after pause/skip) is ignored by the machine.
import { useEffect } from 'react';
import { useLatest } from '../lib/useLatest';
import { findPhrase, promptOf } from '../state/catalog';
import { currentPhraseId, phaseDurationMs } from '../state/selectors';
import { useStore } from '../state/store';
import { GAP_MS, RATE_HOLD_MS } from '../state/timing';
import { holdCue, turnCue } from './cues';
import { canSpeak, Playback, PlaybackResult, preloadClip, silence, speak } from './speech';

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
        // A target this device can't say stops the phrase before its prompt: the learner's
        // turn would be for nothing, and the answer would never be heard.
        if (!phrase.audio?.[phrase.targetLang] && !canSpeak(phrase.targetLang)) {
          playback = { done: Promise.resolve({ status: 'failed', reason: 'no-voice' }), cancel: () => {} };
          break;
        }
        lang = prompt.lang;
        playback = speakThenGap(speak(prompt.text, prompt.lang, speed, phrase.audio?.[prompt.lang]));
        break;
      // The learner's turn and the hold last exactly as long as the machine fixed when they
      // started (`phaseMs`), which is also what the screen counts down.
      case 'pause': {
        turnCue();
        playback = silence(s.player.phaseMs ?? phaseDurationMs(s) ?? 0);
        break;
      }
      case 'target':
        playback = speakThenGap(speak(phrase.target, phrase.targetLang, speed, phrase.audio?.[phrase.targetLang]));
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
        const spoken = phase === 'native' || phase === 'target';
        // A duration is kept as the phrase's length at 1×, and must be measured. A clip's
        // is (the file plays at the rate we set). Synthesised speech doesn't scale
        // linearly with its rate (iOS maps it, voices clamp it, pauses don't stretch), so
        // speech measured at another speed would be an estimate: it isn't recorded.
        const clip = Boolean(phrase.audio?.[lang]);
        const measured = spoken && result.ms !== null && (clip || speed === 1);
        actions.phaseDone(cycle, measured ? { measuredMs: Math.round(result.ms! * speed) } : {});
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
