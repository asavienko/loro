export interface MeterBarProps {
  /** Percentage 0–100. */
  value?: number;
  tone?: 'accent' | 'grow' | 'gold' | 'ink';
  height?: number;
  track?: string;
}
export declare function MeterBar(props: MeterBarProps): JSX.Element;
