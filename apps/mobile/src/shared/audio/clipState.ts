// Waiting for a phrase's clip the server hasn't made yet (P3-01). Every sound is the server's, and a
// new phrase may have no recording until someone first plays it: the server makes it then. Before a
// clip plays, the player asks where it stands (`<clip>.json`: ready, rendering or failed); asked
// about one not made, the server starts making it. While it is being made the player says so, and
// asks again every moment until it is ready, can't be made, or has taken too long.
//
// Both players use this (src/shared/audio/speech.ts on the web, src/platform/speech.ts on iOS and
// Android); each brings its own way to ask and to wait, so the native one keeps its natively timed
// waits and runs with the screen locked.

/** What the server said about a clip: `missing` is an older server with no such route. */
export type ClipAnswer = 'ready' | 'rendering' | 'failed' | 'missing' | 'unreachable';

/** How the wait ended: `ready` plays it, `unmade` couldn't be made, `unreachable` was never answered. */
export type ClipOutcome = 'ready' | 'unmade' | 'unreachable';

export interface ClipIo {
  /** Asks the server about a clip, and calls `answer` once. Returns a cancel. */
  ask: (stateUrl: string, answer: (a: ClipAnswer) => void) => () => void;
  /** Calls `then` after `ms`. Returns a cancel. */
  wait: (ms: number, then: () => void) => () => void;
}

/** How often a clip being made is asked about again. */
export const CLIP_POLL_MS = 1_500;
/** How long the player waits for a clip to be made before saying it couldn't be. */
export const CLIP_MAKE_MS = 60_000;

/** The URL that says where a clip stands: the clip's own, `.json` for `.mp3`, its query kept. */
export function clipStateUrl(clipUrl: string): string {
  const at = clipUrl.indexOf('?');
  const path = at < 0 ? clipUrl : clipUrl.slice(0, at);
  const query = at < 0 ? '' : clipUrl.slice(at);
  return `${path.replace(/\.mp3$/, '')}.json${query}`;
}

/** Reads the server's answer: its status, or `failed` for anything else. */
export function readClipState(status: number, body: string): ClipAnswer {
  if (status === 404) return 'missing';
  if (status < 200 || status >= 300) return 'failed';
  try {
    const parsed = JSON.parse(body) as { status?: unknown };
    return parsed.status === 'ready' || parsed.status === 'rendering' ? parsed.status : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Waits until a clip can play. `onRendering` is called once, the first time the server says it is
 * making it; `done` once, with how the wait ended. An older server that has no state route plays the
 * clip as before. Returns a cancel.
 */
export function awaitClip(
  clipUrl: string,
  io: ClipIo,
  onRendering: () => void,
  done: (outcome: ClipOutcome) => void,
  pace = { pollMs: CLIP_POLL_MS, makeMs: CLIP_MAKE_MS },
): () => void {
  const url = clipStateUrl(clipUrl);
  let finished = false;
  let rendering = false;
  let stop = () => {};
  let waited = 0;
  const finish = (outcome: ClipOutcome) => {
    if (finished) return;
    finished = true;
    done(outcome);
  };
  const ask = () => {
    stop = io.ask(url, (answer) => {
      if (finished) return;
      if (answer === 'ready' || answer === 'missing') return finish('ready');
      if (answer === 'failed') return finish('unmade');
      // Unreachable before it was ever being made is the connection; while it is, keep asking.
      if (answer === 'unreachable' && !rendering) return finish('unreachable');
      if (answer === 'rendering' && !rendering) {
        rendering = true;
        onRendering();
      }
      if (waited >= pace.makeMs) return finish('unmade');
      waited += pace.pollMs;
      stop = io.wait(pace.pollMs, ask);
    });
  };
  ask();
  return () => {
    finished = true;
    stop();
  };
}
