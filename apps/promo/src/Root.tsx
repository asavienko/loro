import { Composition } from 'remotion'
import './fonts'
import { Main } from './Main'
import { tl } from './time'

export function Root() {
  return (
    <Composition
      id="LoroPromo"
      component={Main}
      durationInFrames={Math.ceil(tl.duration * tl.fps)}
      fps={tl.fps}
      width={tl.width}
      height={tl.height}
    />
  )
}
