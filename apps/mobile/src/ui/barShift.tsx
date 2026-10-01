// Where the bar's card is while it is dragged or slides to another item (MiniBar), for the grades that
// float above it (BarGrades): they move and fade with the card, and a new item's come in with it.
import { createContext, ReactNode, useContext, useMemo } from 'react';
import { SharedValue, useSharedValue } from 'react-native-reanimated';

export interface BarShift {
  /** The card's offset from its place, in dp: 0 at rest, the drag while dragged. */
  x: SharedValue<number>;
  /** How far a card travels to the next item's place: gone from view there. */
  span: SharedValue<number>;
}

const BarShiftContext = createContext<BarShift | null>(null);

export function BarShiftProvider({ children }: { children: ReactNode }) {
  const x = useSharedValue(0);
  const span = useSharedValue(0);
  const value = useMemo(() => ({ x, span }), [x, span]);
  return <BarShiftContext.Provider value={value}>{children}</BarShiftContext.Provider>;
}

/** The bar's shift, or null outside the tabs (nothing floats over a bar there). */
export function useBarShift(): BarShift | null {
  return useContext(BarShiftContext);
}
