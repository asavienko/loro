// Letting go of an expo-audio player made with createAudioPlayer (a phrase clip's, one per clip).
//
// `remove()` alone is not enough: in expo-audio 1.1 it only takes the player off the module's list,
// and on Android the ExoPlayer behind it, with the system audio track it holds, lives on until the
// JavaScript object is collected. Android gives an app a few dozen tracks, so after some minutes of
// clips every new player failed to make one ("AudioFlinger could not create track", status -12): a
// song went silent while it still showed as playing, and clips with it, while the cues, whose
// players were made early and kept, still sounded. `release()` frees the native player at once, as
// `useAudioPlayer` does when its component goes.

/** What letting go needs of a player: expo-audio's `AudioPlayer` has both. */
export interface Releasable {
  remove(): void;
  release(): void;
}

/** Takes the player off expo-audio's list and frees its native player and audio track now. */
export function releasePlayer(player: Releasable): void {
  try {
    player.remove();
  } catch {
    // Already gone from the list: it still has to be freed.
  }
  try {
    player.release();
  } catch {
    // Already released.
  }
}
