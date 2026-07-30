import * as React from 'react';
export interface SwitcherHandleProps {
  /** Shown on first runs, then dropped — pass null once the gesture is learned. */
  hint?: string | null;
  onOpen?: () => void;
  style?: React.CSSProperties;
}
export declare function SwitcherHandle(props: SwitcherHandleProps): JSX.Element;
