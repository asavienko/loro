export interface StepDotsProps {
  /** Zero-based current step. */
  step?: number;
  total?: number;
  /** Renders a ‹ back control when provided. */
  onBack?: () => void;
}
export declare function StepDots(props: StepDotsProps): JSX.Element;
