// Runs the side effects of the state machine's current phase: speak the
// native prompt, hold a silence for the learner to say it, speak the target.
// Each finished phase is reported back as PHASE_DONE with the phase's cycle,
// so a stale completion (after pause/skip) is ignored by the machine.
import { useEffect, useRef } from 'react';
import { getPhrase } from '../content';
import { currentPhraseId } from '../state/machine';
import { useStore } from '../state/store';
import { estimateSpeechMs, Playback, silence, speak } from './speech';

const PAUSE_FACTOR = 1.3;
const PAUSE_PADDING_MS = 600;
const PAUSE_MIN_MS = 1500;
const PAUSE_MAX_MS = 8000;

/** Time to say the phrase yourself: a bit longer than the target takes to say. */
export function pauseMs(targetMsAt1x: number | null, text: string, speed: number): number {
  const spoken = (targetMsAt1x ?? estimateSpeechMs(text, 1)) / speed;
  return Math.min(PAUSE_MAX_MS, Math.max(PAUSE_MIN_MS, spoken * PAUSE_FACTOR + PAUSE_PADDING_MS));
}

export function usePlaybackDriver(): void {
  const { state, actions } = useStore();
  const { status, phase, cycle } = state.player;
  const phraseId = currentPhraseId(state.player);
  // Read when a phase starts: a new speed or measurement applies from the next
  // phase and must not restart the one in progress.
  const latest = useRef({ speed: state.player.speed, targetMsAt1x: null as number | null });
  latest.current = {
    speed: state.player.speed,
    targetMsAt1x: phraseId ? (state.learner.phrases[phraseId]?.targetMsAt1x ?? null) : null,
  };

  useEffect(() => {
    if (status !== 'playing' || !phraseId) return;
    const phrase = getPhrase(phraseId);
    const { speed, targetMsAt1x } = latest.current;
    const utterance = phase === 'native' ? phrase.native : phrase.target;
    const playback: Playback =
      phase === 'pause'
        ? silence(pauseMs(targetMsAt1x, phrase.target.text, speed))
        : speak(utterance.text, utterance.lang, speed);
    let active = true;
    playback.done.then((result) => {
      if (!active) return;
      if (result.status === 'failed') {
        actions.phaseDone(cycle, { failedLang: utterance.lang });
      } else {
        const measured = phase === 'target' && result.status === 'ended' ? result.ms * speed : undefined;
        actions.phaseDone(cycle, { measuredMsAt1x: measured });
      }
    });
    return () => {
      active = false;
      playback.cancel();
    };
  }, [status, phase, cycle, phraseId, actions]);
}
