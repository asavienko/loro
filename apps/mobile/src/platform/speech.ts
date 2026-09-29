// The device voice on iOS and Android: expo-speech in place of the web prototype's Web Speech API
// (its src/audio/speech.ts, whose exports this mirrors; metro.config.js swaps it in). As there,
// speech is measured from its start to its end, so the engine's start-up never counts as the
// phrase's length, and a voice that says nothing is reported, never papered over.
import { createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { LanguageCode } from '@shared/content';
import { clock } from '@shared/state/clock';
import { estimateSpeechMs } from '@shared/state/timing';

export type PlaybackResult = { status: 'ended'; ms: number | null } | { status: 'timeout' } | { status: 'failed'; reason: FailureReason };
export type FailureReason = 'no-voice' | 'silent';

export interface Playback {
  done: Promise<PlaybackResult>;
  cancel: () => void;
}

/** A device voice, as the web's SpeechSynthesisVoice describes one (what Settings lists). */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  /** expo-speech's handle for it. */
  identifier: string;
}

let voices: VoiceInfo[] = [];
let loaded = false;
let loading: Promise<void> | null = null;

function loadVoices(): Promise<void> {
  loading ??= Speech.getAvailableVoicesAsync()
    .then((list) => {
      voices = list.map((v) => ({
        name: v.name,
        lang: v.language,
        // expo-speech doesn't say which voices need the network; the "Enhanced" ones are downloaded.
        localService: true,
        default: false,
        identifier: v.identifier,
      }));
      loaded = true;
    })
    .catch(() => {
      loaded = true;
    });
  return loading;
}
void loadVoices();

/** The best voice for `lang`: its region first, then a higher-quality voice (as the web picks). */
export function bestVoice<V extends Pick<VoiceInfo, 'name' | 'lang' | 'localService' | 'default'>>(list: readonly V[], lang: string): V | null {
  const want = lang.toLowerCase();
  const base = want.split('-')[0];
  let best: V | null = null;
  let bestScore = -1;
  for (const v of list) {
    const tag = v.lang.replace('_', '-').toLowerCase();
    if (tag !== want && tag.split('-')[0] !== base) continue;
    const score = (tag === want ? 8 : 0) + (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

let chosen: Partial<Record<string, string>> = {};
export function setVoiceChoices(choices: Partial<Record<string, string>>): void {
  chosen = choices;
}

export function chooseVoice<V extends Pick<VoiceInfo, 'name' | 'lang' | 'localService' | 'default'>>(
  list: readonly V[],
  lang: string,
  chosenName: string | undefined,
  _online: boolean,
): V | null {
  const base = lang.split('-')[0];
  const mine = chosenName ? list.find((v) => v.name === chosenName && v.lang.replace('_', '-').split('-')[0] === base) : undefined;
  return mine ?? bestVoice(list, lang);
}

function pickVoice(lang: LanguageCode): VoiceInfo | null {
  return chooseVoice(voices, lang, chosen[lang], true);
}

/** Every device voice that speaks `lang` (any region), best first. */
export function voicesFor(lang: LanguageCode): VoiceInfo[] {
  const out: VoiceInfo[] = [];
  let rest = [...voices];
  for (let v = bestVoice(rest, lang); v; v = bestVoice(rest, lang)) {
    out.push(v);
    rest = rest.filter((x) => x !== v);
  }
  return out;
}

export function voiceName(lang: LanguageCode): string | null {
  return pickVoice(lang)?.name ?? null;
}

/** Whether the device can say `lang`; until the list has loaded, it isn't known not to. */
export function canSpeak(lang: LanguageCode): boolean {
  return !loaded || voices.length === 0 || Boolean(pickVoice(lang));
}

export function waitForVoices(timeoutMs = 1500): Promise<void> {
  return Promise.race([loadVoices(), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** Clips are streamed when played; the server keeps them ready. */
export function preloadClip(_url: string): void {}

/** A clip that never loads or never ends gives way after this, or twice its length. */
const CLIP_STALL_MS = 15_000;

/** How long a clip may take to answer (the server renders one it hasn't yet) and then to load. */
const CLIP_CHECK_MS = 8_000;
const CLIP_LOAD_MS = 5_000;

/**
 * Whether the clip can be fetched. expo-audio reports no load error, so a clip the server can't
 * make (offline, a voice it lacks) is found here, at once, rather than after a silent wait.
 */
async function clipAvailable(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal });
    return response.ok;
  } catch {
    return false;
  }
}

/** A clip from the server's voice (plan 106), measured by its own length. */
function playClip(url: string, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const check = new AbortController();
  const checkTimer = setTimeout(() => check.abort(), CLIP_CHECK_MS);
  let cancelled = false;
  let playing: Playback | null = null;
  void clipAvailable(url, check.signal).then((ok) => {
    clearTimeout(checkTimer);
    if (cancelled) return;
    if (!ok) return resolve({ status: 'failed', reason: 'silent' });
    playing = startClip(url, rate);
    void playing.done.then(resolve);
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      clearTimeout(checkTimer);
      check.abort();
      playing?.cancel();
    },
  };
}

function startClip(url: string, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const player = createAudioPlayer({ uri: url }, { updateInterval: 100 });
  let settled = false;
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    subscription.remove();
    player.remove();
    resolve(r);
  };
  let watchdog = setTimeout(() => settle({ status: 'failed', reason: 'silent' }), CLIP_LOAD_MS);
  let started = false;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.isLoaded && !started) {
      started = true;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => settle({ status: 'timeout' }), status.duration > 0 ? (status.duration * 2000) / rate + 3000 : CLIP_STALL_MS);
    }
    if (status.didJustFinish) settle({ status: 'ended', ms: (status.duration * 1000) / rate });
  });
  player.setPlaybackRate(rate);
  player.play();
  return {
    done,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      subscription.remove();
      player.pause();
      player.remove();
    },
  };
}

/** A clip, and if it can't play, the device voice says the phrase instead. */
function clipOrSpeech(url: string, text: string, lang: LanguageCode, rate: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  let current = playClip(url, rate);
  let cancelled = false;
  void current.done.then((result) => {
    if (cancelled) return;
    if (result.status !== 'failed') return resolve(result);
    current = speak(text, lang, rate);
    // The driver treats a clip's length as measured; speech at another speed isn't.
    void current.done.then((r) => !cancelled && resolve(r.status === 'ended' && rate !== 1 ? { status: 'ended', ms: null } : r));
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      current.cancel();
    },
  };
}

/** An end this soon after the call, with no start, means the engine said nothing. */
const SILENT_END_SHARE = 0.4;

export function speak(text: string, lang: LanguageCode, rate: number, clipUrl?: string | null): Playback {
  if (clipUrl) return clipOrSpeech(clipUrl, text, lang, rate);
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  if (!canSpeak(lang)) {
    resolve({ status: 'failed', reason: 'no-voice' });
    return { done, cancel: () => {} };
  }
  let settled = false;
  const settle = (r: PlaybackResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    resolve(r);
  };
  const expected = estimateSpeechMs(text, rate);
  // Some engines never report the end: the lesson mustn't stall.
  const watchdog = setTimeout(() => {
    void Speech.stop();
    settle({ status: 'timeout' });
  }, expected * 3 + 2000);
  const calledAt = clock.now();
  let startedAt: number | null = null;
  Speech.speak(text, {
    language: lang,
    rate,
    voice: pickVoice(lang)?.identifier,
    onStart: () => {
      startedAt = clock.now();
    },
    onDone: () => {
      if (startedAt !== null) return settle({ status: 'ended', ms: clock.now() - startedAt });
      settle(clock.now() - calledAt >= expected * SILENT_END_SHARE ? { status: 'ended', ms: null } : { status: 'failed', reason: 'silent' });
    },
    onError: () => settle({ status: 'failed', reason: 'silent' }),
  });
  return {
    done,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      void Speech.stop();
    },
  };
}

export function stopSpeech(): void {
  void Speech.stop();
}

export function silence(ms: number): Playback {
  let resolve: (r: PlaybackResult) => void = () => {};
  const done = new Promise<PlaybackResult>((r) => (resolve = r));
  const timer = setTimeout(() => resolve({ status: 'ended', ms }), ms);
  return { done, cancel: () => clearTimeout(timer) };
}
