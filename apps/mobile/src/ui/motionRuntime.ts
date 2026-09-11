/**
 * Reanimated constructors for tokenised easing. Keep this off `motion.ts` so Node
 * tests can import the adapter without a native runtime.
 */

import { Easing } from 'react-native-reanimated'
import { motionEasing, type CubicBezier } from './motion'

function bezier(curve: CubicBezier) {
  return Easing.bezier(curve[0], curve[1], curve[2], curve[3])
}

export const reanimatedEasing = {
  out: bezier(motionEasing.out),
  pop: bezier(motionEasing.pop),
  press: bezier(motionEasing.press),
  inOut: Easing.inOut(Easing.ease),
  linear: Easing.linear,
  ease: Easing.ease,
}
