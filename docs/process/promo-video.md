# The landing page's video

`apps/promo` makes the landing page's motion video entirely in code: no editor, no stock footage, no
stock music. One command (`pnpm --filter @loro/promo video`) produces `out/loro-promo.mp4` (the
H.264 master, 1920 × 1080, 30 fps), `out/loro-promo-web.mp4` (about 10 MB with `faststart`: the one
to put on the page) and a poster frame; `render:webm` adds a VP9 `out/loro-promo.webm`. How to run
it is in [`apps/promo/README.md`](../../apps/promo/README.md).

## What it shows

About 80 seconds in seven scenes, narrated: the mark and the promise ("one phrase at a time"); the
loop on the player (hear it in English, say it in the pause, hear it in Spanish, say it again, rate
it); FSRS bringing the phrase back; hands-free on the lock screen; the six course languages, each
phrase in its course's voice; Create writing a set with AI and a song from it; the two promises (the
voice stays on the phone, no screen shames a missed day); the end card. Word-by-word captions carry
the narration, because a landing page autoplays muted.

## Decisions

| Decision                                                                                                                    | Why                                                                                                                                                                                                                                                         | Rejected                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remotion** (React → MP4) in its own workspace package, `@loro/promo`                                                      | Scenes are React components with the app's real tokens: `src/theme.ts` imports `apps/mobile/src/ui/theme.ts` and the icon codepoints, so the video can't drift from the app's palette or icons.                                                             | Screen recordings of the app (need seeded content and a device; go stale with every change); a video editor (not reproducible from the repo). |
| **Screens redrawn, not captured**                                                                                           | The player, lock screen and Create are rebuilt at the app's own sizes from `NowPlayingScreen.tsx` and friends, and animated to the narration.                                                                                                               | Captured screenshots: can't animate step by step or stay in time with the voice.                                                              |
| **The app's own ElevenLabs voices** for every phrase; a premade ElevenLabs narrator ("George") distinct from them           | A learner hears exactly these voices in the app. The Polish and Czech lines were made before those languages had voices (`TTS_VOICE_PL_PL`, `TTS_VOICE_CS_CZ`, pinned 2026-10-02), in the Russian and Bulgarian voices; remaking them in their own is left. | Device voices (`say`): kept only as the fallback when no key is set.                                                                          |
| **Voice is cached by text, voice and model** in `src/generated/voice.json` (committed) and `public/voice/*.mp3` (committed) | Re-running costs nothing; only a changed line is paid for again. The key is read from `ELEVENLABS_API_KEY` or `apps/api/.env`, never written anywhere.                                                                                                      | Rendering every line on every run.                                                                                                            |
| **Music and effects synthesized** in `scripts/synth.mjs`, scored to the timeline (seeded, deterministic)                    | No licensing question, and the arrangement follows the scenes: sparse under the loop so the phrases are clear, a groove for hands-free and Create, a breakdown for the promises, a resolved last chord.                                                     | Stock or AI music.                                                                                                                            |
| **One master mix** (music ducked 10 dB under every line and clip, then −16 LUFS, −1.5 dBTP)                                 | Web-video loudness; the voice always on top.                                                                                                                                                                                                                | Mixing per frame in Remotion: no loudness normalisation.                                                                                      |
| **The timeline comes from the clips' real lengths** (`scripts/timeline.mjs`)                                                | Picture, captions, effects and music all follow the voice; change a line and everything moves with it.                                                                                                                                                      | Hand-placed frame numbers.                                                                                                                    |

## The non-negotiables, in a promo

- **No invented numbers.** The memory curve has no axis values; the grades show no intervals, as in
  the app. The waveforms beside each phrase are the clip's real spectrum, frame by frame
  (`visualizeAudio`). "5 left today" and "12 phrases" are mock-up labels on a drawn screen, not
  claims about a learner.
- **Nothing recorded.** The learner's turn is drawn with the app's speaking-person icon, never a
  microphone.
- **No shame.** The missed day in the week row is an empty dashed circle, not a red mark.
- **AI says what it is.** The generated set carries the app's "Written by AI" badge.

## Licence

Remotion is free for individuals and for companies of up to three people; a larger company needs a
[Remotion company licence](https://www.remotion.dev/license) to render with it.

## Publishing

The landing page plays `out/loro-promo-web.mp4` with the poster, from the landing media bucket:
`pnpm promo:upload`, then `pnpm landing:deploy`
([landing-deployment.md](landing-deployment.md#the-videos-files-the-media-bucket)). The page's
transcript under the video repeats `scripts/lines.mjs`; change both together.
