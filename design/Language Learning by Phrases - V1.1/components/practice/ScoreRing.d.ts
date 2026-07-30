export interface ScoreRingProps {
  /** 0–100. ≥85 reads green, ≥65 gold, below that brick. */
  value?: number;
  size?: number;
  /** Optional caption to the right of the ring. */
  label?: string;
}
export declare function ScoreRing(props: ScoreRingProps): JSX.Element;
