import * as React from 'react';
export interface SectionLabelProps {
  children?: React.ReactNode;
  /** 'app' = 9px .13em inside a screen; 'rail' = 11px .16em with an underline, on the blueprint canvas. */
  variant?: 'app' | 'rail';
  style?: React.CSSProperties;
}
export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
