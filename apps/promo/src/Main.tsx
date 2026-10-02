// The video: paper, the scenes over it, the phone that runs through the middle, the captions, and the
// mix (voice, music and effects, made by scripts/synth.mjs to the same timeline).
import { AbsoluteFill, Html5Audio, staticFile } from 'remotion'
import { End } from './scenes/EndIndex'
import { Intro } from './scenes/Intro'
import { LoopSide } from './scenes/Loop'
import { CreateSide, HandsFree, Languages } from './scenes/Middle'
import { PhoneStage } from './scenes/Phone'
import { tl } from './time'
import { Captions } from './ui/Captions'
import { Paper } from './ui/kit'

const S = tl.scenes
/** Captions go under the right-hand column while the phone stands on the left. */
const captionSide = (t: number) =>
  (t >= S.loop.from && t < S.handsfree.from) || (t >= S.create.from && t < S.privacy.from)
    ? 'right'
    : 'center'

export function Main() {
  return (
    <AbsoluteFill>
      <Paper />
      <Intro />
      <LoopSide />
      <HandsFree />
      <Languages />
      <CreateSide />
      <End />
      <PhoneStage />
      <Captions align={captionSide} />
      <Html5Audio src={staticFile('audio/mix.wav')} />
    </AbsoluteFill>
  )
}
