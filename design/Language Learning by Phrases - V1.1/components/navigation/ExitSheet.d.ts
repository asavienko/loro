import * as React from 'react';
export interface ExitSheetProps {
  /** "Stop after rep 3?" — name the place, not the loss. */
  title: string;
  body?: string;
  pauseLabel?: string;
  endLabel?: string;
  stayLabel?: string;
  /** "Pausing leaves a resume row on Today · ending clears it." */
  footnote?: string;
  onPause?: () => void;
  onEnd?: () => void;
  onStay?: () => void;
  style?: React.CSSProperties;
}
export declare function ExitSheet(props: ExitSheetProps): JSX.Element;
