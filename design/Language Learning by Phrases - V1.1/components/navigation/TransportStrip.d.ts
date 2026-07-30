import * as React from 'react';
export interface TransportStripProps {
  title: string;
  /** "Ambient loop · 3 of 5" — wave, phrase, position. */
  meta?: string;
  /** hairline on paper (default) or the dark strip when the list beneath is busy. */
  tone?: 'hairline' | 'dark';
  /** ❙❙ pauses and keeps the strip. */
  onPause?: () => void;
  /** ✕ ends the loop and removes it. */
  onEnd?: () => void;
  style?: React.CSSProperties;
}
export declare function TransportStrip(props: TransportStripProps): JSX.Element;
