import * as React from 'react';
export interface ResumeStripProps {
  /** States a fact — never "you didn't finish". */
  label?: string;
  /** "Evening wave · rep 3 of 6". */
  title: string;
  done?: number;
  total?: number;
  restartLabel?: string;
  onRestart?: () => void;
  style?: React.CSSProperties;
}
export declare function ResumeStrip(props: ResumeStripProps): JSX.Element;
