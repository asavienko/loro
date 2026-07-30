import * as React from 'react';
export interface ArrivalNoteProps {
  /** "Opened from your widget", "From a notification" — the entry point, never a parent that doesn't exist. */
  children?: React.ReactNode;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}
export declare function ArrivalNote(props: ArrivalNoteProps): JSX.Element;
