import * as React from 'react';
export type SurfaceClass = 'root' | 'push' | 'session' | 'flow';
export interface ScreenHeaderProps {
  /** The surface class this screen belongs to — it decides the whole band. */
  variant?: SurfaceClass;
  /** root: the date line above the title. */
  date?: string;
  title?: string;
  /** push: back always names its target ("Today", "Phrasebook"). Omit for a cold start — the glyph becomes ✕. */
  backLabel?: string;
  action?: string;
  /** session: 0–1. */
  progress?: number;
  /** flow: 1-based. */
  step?: number;
  steps?: number;
  /** session: "3/6" or "rep 3/6". */
  position?: string;
  onBack?: () => void;
  onAction?: () => void;
  style?: React.CSSProperties;
}
export declare function ScreenHeader(props: ScreenHeaderProps): JSX.Element;
