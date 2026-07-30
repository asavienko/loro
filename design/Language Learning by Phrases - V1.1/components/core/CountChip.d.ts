import * as React from 'react';
export interface CountChipProps {
  children?: React.ReactNode;
  tone?: 'accent' | 'grow' | 'quiet';
  onClick?: () => void;
}
export declare function CountChip(props: CountChipProps): JSX.Element;
