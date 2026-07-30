import * as React from 'react';

/**
 * The Loro device frame — every app screen is authored inside one.
 * @startingPoint section="Frames" subtitle="344×732 phone with bezel and inner screen" viewport="700x340"
 */
export interface PhoneFrameProps {
  /** Accent theme applied to everything inside. */
  accent?: 'coral' | 'sunset' | 'teal' | 'berry';
  /** 'app' = #F6F2EA (phases 1–4), 'chat' = #FBF9F4 (conversation surfaces). */
  surface?: 'app' | 'chat';
  /** Visual scale for blueprint layouts. Default 1. */
  scale?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PhoneFrame(props: PhoneFrameProps): JSX.Element;
