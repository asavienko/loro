/**
 * A single answer in a setup question — tappable, multi- or single-select.
 * @startingPoint section="Forms" subtitle="Emoji + label + sub, with a selected state" viewport="700x150"
 */
export interface ChoiceCardProps {
  /** Legacy emoji from onboarding; omit for new screens. */
  emoji?: string;
  label: string;
  sub?: string;
  selected?: boolean;
  onClick?: () => void;
}
export declare function ChoiceCard(props: ChoiceCardProps): JSX.Element;
