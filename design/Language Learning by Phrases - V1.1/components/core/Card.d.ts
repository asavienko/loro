import * as React from 'react';
export interface CardProps {
  /** plain = white hairline; grow = green progress; note = amber teaching aside; dark = inverted hero card. */
  tone?: 'plain' | 'grow' | 'note' | 'dark';
  radius?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}
export declare function Card(props: CardProps): JSX.Element;
