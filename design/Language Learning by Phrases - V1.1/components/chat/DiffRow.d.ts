export interface DiffRowProps {
  /** The learner's original wording. */
  was: string;
  /** The corrected wording, or '—' when a word should simply be dropped. */
  now: string;
  /** Mistake class: Agreement, Extra word, Accent, Register… */
  kind?: string;
  /** One-sentence reason, written in second person. */
  why?: string;
  first?: boolean;
}
export declare function DiffRow(props: DiffRowProps): JSX.Element;
