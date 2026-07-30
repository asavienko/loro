import * as React from 'react';
/**
 * One conversation line, with on-demand translation and a fix flag.
 * @startingPoint section="Chat" subtitle="Loro's line, the learner's tinted bubble, fix flag" viewport="700x230"
 */
export interface MessageBubbleProps {
  from?: 'them' | 'me';
  /** Spanish — always shown. */
  es: string;
  /** English — only rendered when showEn is true. */
  en?: string;
  showEn?: boolean;
  /** Selected lines darken and reveal their action row. */
  selected?: boolean;
  /** Number of mistakes found in the learner's line. */
  fixCount?: number;
  onClick?: () => void;
  /** InlineAction row, rendered only while selected. */
  children?: React.ReactNode;
}
export declare function MessageBubble(props: MessageBubbleProps): JSX.Element;
