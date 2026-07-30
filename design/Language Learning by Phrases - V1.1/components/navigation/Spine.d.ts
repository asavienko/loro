import * as React from 'react';
export interface OngoingThing {
  /** "Evening wave 3/6", "Voy tirando", "Setup 2/4" — short enough for the band. */
  label: string;
  /** Audio: the dot becomes a four-bar equaliser. */
  playing?: boolean;
  /** Its transport is expanded below the spine, so the chip shows ⌃. */
  expanded?: boolean;
}
export interface SpineProps {
  /** Where you are, named: "Today", "Phrasebook", "Evening wave", "More". */
  place: string;
  /** What is still running. One chip; two or more collapse to "2 ongoing". Omit when nothing is. */
  ongoing?: OngoingThing | OngoingThing[] | null;
  /** Opens the switcher — the same sheet from every class. */
  onOpen?: () => void;
  /** Returns to the ongoing thing, or expands its transport when it is audio. */
  onResume?: () => void;
  style?: React.CSSProperties;
}
export declare function Spine(props: SpineProps): JSX.Element;
