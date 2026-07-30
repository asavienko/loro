export interface VoiceWaveProps {
  /** Overall height; bars are clamped to it. */
  height?: number;
  /** 'on-dark' switches to the lighter accent for dark cards. */
  tone?: 'accent' | 'on-dark';
  /** Bar heights, left to right. */
  bars?: number[];
}
export declare function VoiceWave(props: VoiceWaveProps): JSX.Element;
