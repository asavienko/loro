import * as React from 'react';
export interface TagProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'grow' | 'alert' | 'gold';
  /** Drop the pill background and show caps text only (used at the right edge of rows). */
  bare?: boolean;
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
