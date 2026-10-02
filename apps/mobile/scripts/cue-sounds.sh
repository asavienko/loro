#!/usr/bin/env bash
# Makes takes of the player's cue sounds with ElevenLabs' sound generator, and levels them the way
# the bundled ones in assets/sounds were (docs/design/v2-prototype-decisions.md, "Cue sounds").
# Takes land in an output directory to be listened to; copying the chosen one over
# assets/sounds/<cue>.mp3 is a person's call, never this script's.
#
#   ELEVENLABS_API_KEY=… scripts/cue-sounds.sh [out-dir] [cue…]
#
# Needs curl, jq and ffmpeg (with the aspectralstats filter, 5.1+).
set -euo pipefail

: "${ELEVENLABS_API_KEY:?set ELEVENLABS_API_KEY (the TTS_API_KEY of the API)}"
OUT=${1:-cue-takes}
shift || true
TAKES=${TAKES:-3}
mkdir -p "$OUT"

# cue | seconds | prompt influence | integrated loudness target (LUFS) | prompt
CUES='turn|0.6|0.7|-26|Soft gentle two-note rising marimba chime, warm and friendly, short UI notification for your turn to speak, clean, no reverb tail, no background noise
hold|0.5|0.7|-30|Single soft muted wooden pluck, calm neutral UI tick, very short, warm and quiet, clean, no background noise
easy|0.5|0.75|-25|Warm rounded wooden bubble pop with a soft marimba ding, satisfying tactile correct-answer UI sound, mellow mid tone, short, gentle, clean, no background noise
gentle|0.6|0.7|-28|Soft low single felt piano note, gentle and neutral, calm UI feedback, not sad, not an error buzzer, short, clean, no background noise
learned|1.6|0.6|-23|Joyful warm rising arpeggio of soft bells and marimba, rewarding achievement unlocked UI sound, satisfying sparkle at the end, short, not loud, clean, no background noise
pass|2.0|0.6|-23|Warm uplifting short celebration jingle, soft marimba and glockenspiel, session complete reward sound, satisfying resolve, gentle, clean, no background noise'

wanted=" $* "
while IFS='|' read -r cue seconds influence target prompt; do
  [[ $# -gt 0 && $wanted != *" $cue "* ]] && continue
  for take in $(seq 1 "$TAKES"); do
    raw="$OUT/$cue-$take.raw.mp3"
    jq -n --arg t "$prompt" --argjson d "$seconds" --argjson p "$influence" \
      '{text: $t, duration_seconds: $d, prompt_influence: $p, model_id: "eleven_text_to_sound_v2"}' |
      curl -sS -f -X POST 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128' \
        -H "xi-api-key: $ELEVENLABS_API_KEY" -H 'content-type: application/json' -d @- -o "$raw"
    # Trim, soften the top, mono; then measure and level to the cue's target.
    wav="$OUT/$cue-$take.wav"
    ffmpeg -v error -y -i "$raw" -af 'silenceremove=start_periods=1:start_threshold=-48dB,highpass=f=80,lowpass=f=12000' -ac 1 -ar 44100 "$wav"
    length=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$wav")
    loudness=$(ffmpeg -hide_banner -i "$wav" -af 'apad=whole_dur=0.5,ebur128' -f null - 2>&1 | awk '/Integrated loudness/{f=1} f&&/I:/{print $2; exit}')
    gain=$(awk -v t="$target" -v i="$loudness" 'BEGIN{printf "%.2f", t - i}')
    fade=$(awk -v d="$length" 'BEGIN{printf "%.3f", (d < 0.25) ? 0.03 : 0.08}')
    start=$(awk -v d="$length" -v f="$fade" 'BEGIN{printf "%.3f", d - f}')
    ffmpeg -v error -y -i "$wav" -af "afade=t=in:d=0.004,afade=t=out:st=$start:d=$fade,volume=${gain}dB,alimiter=limit=0.7:level=false" \
      -c:a libmp3lame -b:a 96k "$OUT/$cue-$take.mp3"
    centroid=$(ffmpeg -hide_banner -i "$OUT/$cue-$take.mp3" -af 'aspectralstats=measure=centroid,ametadata=print:key=lavfi.aspectralstats.1.centroid' -f null - 2>&1 |
      awk -F= '/centroid/{s+=$2; c++} END{if (c) printf "%.0f", s/c}')
    rm -f "$raw" "$wav"
    printf '%-8s take %s  %.2f s  brightness %s Hz\n' "$cue" "$take" "$length" "$centroid"
  done
done <<<"$CUES"
