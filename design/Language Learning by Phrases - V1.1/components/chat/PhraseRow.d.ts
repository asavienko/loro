export interface PhraseRowProps {
  es: string;
  en?: string;
  /** Register/label shown as bare caps: casual, formal, very local… */
  register?: string;
  /** '+' to add, 'saved' for the green tick. */
  state?: 'add' | 'saved';
  /** Tap the text — loads the phrase into the composer. */
  onPick?: () => void;
  onHear?: () => void;
  /** Optional right-hand outlined action (default label "Send"). */
  onSecondary?: () => void;
  secondaryLabel?: string;
  first?: boolean;
}
export declare function PhraseRow(props: PhraseRowProps): JSX.Element;
