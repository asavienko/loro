import { useMemo, useRef } from 'react'
import { PanResponder } from 'react-native'

const ACTIVATION_DISTANCE = 4
const COMMIT_DISTANCE = 48
const VERTICAL_DOMINANCE = 2

/** Attach only to a dedicated handle so content scrolling keeps its normal responder. */
export function usePullDown(onPull: () => void) {
  const callback = useRef(onPull)
  callback.current = onPull
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.numberActiveTouches === 1 &&
          gesture.dy > ACTIVATION_DISTANCE &&
          gesture.dy > Math.abs(gesture.dx) * VERTICAL_DOMINANCE,
        onPanResponderRelease: (_, gesture) => {
          if (
            gesture.dy >= COMMIT_DISTANCE &&
            gesture.dy > Math.abs(gesture.dx) * VERTICAL_DOMINANCE
          ) {
            callback.current()
          }
        },
        onPanResponderTerminationRequest: () => true,
      }).panHandlers,
    [],
  )
}
