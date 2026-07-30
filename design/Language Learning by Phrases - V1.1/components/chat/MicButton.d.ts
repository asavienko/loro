/**
 * The voice control. Hold = talk and release to send; tap = lock listening until Done.
 * @startingPoint section="Chat" subtitle="Push-to-talk mic with hold, lock and waveform states" viewport="700x150"
 */
export interface MicButtonProps {
  /** 'idle' shows the mic glyph; 'holding' pulses; 'locked' shows the stop square. */
  state?: 'idle' | 'holding' | 'locked';
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onCancel?: () => void;
}
export declare function MicButton(props: MicButtonProps): JSX.Element;
