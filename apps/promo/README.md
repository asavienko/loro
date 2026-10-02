# @loro/promo

The landing page's motion video, made in code: Remotion scenes drawn with the app's tokens, a
synthesized score and sound effects, and a narrated voiceover with the phrases in the app's own
ElevenLabs voices. Why it is built this way:
[docs/process/promo-video.md](../../docs/process/promo-video.md).

```bash
nvm use 22
pnpm --filter @loro/promo video     # everything: audio, the MP4s and the poster
pnpm --filter @loro/promo studio    # preview and scrub in the browser (after `audio`)
pnpm --filter @loro/promo render:webm
```

`video` runs, in order:

| Step       | Script                 | Makes                                                                                   |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `assets`   | `scripts/assets.mjs`   | `public/fonts/`: the app's Material Symbols subset                                      |
| `voice`    | `scripts/voice.mjs`    | `public/voice/*.mp3` and `src/generated/voice.json` (each word's timing); cached        |
| `timeline` | `scripts/timeline.mjs` | `src/generated/timeline.json`: scenes, when each line, clip and effect plays, the marks |
| `synth`    | `scripts/synth.mjs`    | `public/audio/music.wav`, `sfx/*.wav` and `mix.wav` (the master, −16 LUFS)              |
| `render`   | Remotion               | `out/loro-promo.mp4` (1920 × 1080, 30 fps, H.264, AAC)                                  |
| `web`      | ffmpeg                 | `out/loro-promo-web.mp4`: about 10 MB, `faststart`, for the page itself                 |

To change what is said, edit `scripts/lines.mjs` and run `pnpm --filter @loro/promo video`: only
changed lines go to ElevenLabs again, and the timeline, music and pictures follow the new lengths.
The key comes from `ELEVENLABS_API_KEY`, or the API's `TTS_API_KEY` in `apps/api/.env`; with
neither, macOS `say` stands in.

| Path           | What                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `src/Main.tsx` | The composition: paper, scenes, the phone, captions, the mix             |
| `src/scenes/`  | Intro, the loop and memory chart, hands-free, languages, Create, the end |
| `src/screens/` | The app's screens redrawn: the player, the lock screen, Create           |
| `src/ui/`      | Icons, the phone, the paper, the clip waveforms, captions                |
| `src/theme.ts` | Re-exports the app's colours and icon codepoints                         |

`out/`, `public/audio/` and `public/fonts/` are rebuilt for free and not committed.

To put a new render on the landing page: `pnpm promo:upload`, then `pnpm landing:deploy` (from the
repository root, with `AWS_PROFILE=loro AWS_REGION=eu-central-1`;
[landing-deployment.md](../../docs/process/landing-deployment.md#the-videos-files-the-media-bucket)).
