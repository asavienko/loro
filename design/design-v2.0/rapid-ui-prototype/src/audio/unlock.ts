// iOS Safari (and some Android browsers) only allow speech and Web Audio to
// start from inside a user gesture. The player speaks from an effect, a moment
// after the tap, so the first tap anywhere unlocks both: a silent utterance and
// a resumed audio context. After that, speech started by code is allowed.
import { prepareAudio, resumeAudio } from './cues';

let unlocked = false;

function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    const synth = window.speechSynthesis;
    if (synth && !synth.speaking) {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      synth.speak(silent);
    }
  } catch {
    // No speech synthesis: playback will report the missing voice.
  }
  resumeAudio();
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(type, unlock, true);
}

export function installAudioUnlock(): void {
  if (typeof window === 'undefined' || unlocked) return;
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, true);
  if ('requestIdleCallback' in window) window.requestIdleCallback(prepareAudio, { timeout: 3000 });
  else setTimeout(prepareAudio, 1000);
}
