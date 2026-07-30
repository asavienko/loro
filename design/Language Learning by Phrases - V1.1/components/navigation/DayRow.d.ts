import * as React from 'react';
export interface DayRowProps {
  /** "8:10", "19:00", "now", or a bare count. */
  time?: string;
  title: string;
  meta?: string;
  /** done recedes to --day-done-ink; exactly one row is 'next'. */
  state?: 'done' | 'next' | 'idle';
  /** "done" — a fact, never a scold. */
  status?: string;
  last?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function DayRow(props: DayRowProps): JSX.Element;
