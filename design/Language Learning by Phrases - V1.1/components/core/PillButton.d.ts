import * as React from 'react';
/**
 * Filled/outlined pill action.
 * @startingPoint section="Core" subtitle="Primary, grow, secondary, quiet and dark pills" viewport="700x150"
 */
export interface PillButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'grow' | 'secondary' | 'quiet' | 'dark';
  /** Stretch to fill its flex row. */
  full?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function PillButton(props: PillButtonProps): JSX.Element;
