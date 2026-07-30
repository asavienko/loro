import * as React from 'react';
export interface InlineActionProps {
  children?: React.ReactNode;
  /** Optional leading glyph — ♪ hear, ↻ repeat, × cancel, ‹ › navigate. */
  glyph?: string;
  tone?: 'quiet' | 'accent' | 'grow' | 'faint' | 'alert' | 'strong';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function InlineAction(props: InlineActionProps): JSX.Element;
