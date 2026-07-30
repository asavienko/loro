import * as React from 'react';
export interface ToastProps {
  /** One short sentence. Falsy renders nothing. */
  children?: React.ReactNode;
  /** Distance from the bottom of the screen; 84 clears the composer, 34 a plain footer, 26 a full-width CTA. */
  bottom?: number;
  /** Reversal action, almost always "Undo". Extends the toast to ~2.6s. */
  actionLabel?: string;
  onAction?: () => void;
}
export declare function Toast(props: ToastProps): JSX.Element;
