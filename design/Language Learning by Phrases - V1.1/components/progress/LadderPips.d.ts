export interface LadderPipsProps {
  /** Rungs climbed, 0–total. */
  level?: number;
  total?: number;
  tone?: 'accent' | 'grow';
  /** Rung name shown next to the pips: Seen, Shaky, Getting it, Solid, Owned. */
  label?: string;
}
export declare function LadderPips(props: LadderPipsProps): JSX.Element;
