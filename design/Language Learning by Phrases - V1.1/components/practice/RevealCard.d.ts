import * as React from 'react';
/**
 * Recall card for review sessions — prompt, then the answer on reveal.
 * @startingPoint section="Practice" subtitle="Flashcard with reveal and grading" viewport="700x300"
 */
export interface RevealCardProps {
  /** What the learner sees first (usually the English). */
  prompt: React.ReactNode;
  /** Revealed answer (the Spanish), tappable to hear. */
  answer?: React.ReactNode;
  /** Tiny caps eyebrow: "Say it in Spanish", "Memory card"… */
  hint?: string;
  revealed?: boolean;
  onReveal?: () => void;
  onHear?: () => void;
  /** Usually a GradeRow, shown after reveal. */
  footer?: React.ReactNode;
}
export declare function RevealCard(props: RevealCardProps): JSX.Element;
