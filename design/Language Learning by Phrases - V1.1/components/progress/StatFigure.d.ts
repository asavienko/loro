import * as React from 'react';
export interface StatFigureProps {
  value: React.ReactNode;
  /** Short caps label, e.g. PHRASES OWNED. */
  label: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  tone?: 'ink' | 'accent';
}
export declare function StatFigure(props: StatFigureProps): JSX.Element;
