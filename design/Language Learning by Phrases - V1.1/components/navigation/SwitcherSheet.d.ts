import * as React from 'react';
export interface SwitcherItem {
  label: string;
  /** "You're in" — states the consequence of leaving instead of asking. */
  here?: boolean;
  meta?: string;
  count?: number | string;
  /** A flow step's status: "answered". */
  state?: string;
  done?: boolean;
  /** A guarded route: shown flat, never as a dead link. */
  locked?: boolean;
  onClick?: () => void;
}
export interface SwitcherGroup { label: string; items: SwitcherItem[] }
export interface SwitcherSheetProps {
  title?: string;
  note?: string;
  groups?: SwitcherGroup[];
  footerHint?: string | null;
  onSearch?: () => void;
  style?: React.CSSProperties;
}
export declare function SwitcherSheet(props: SwitcherSheetProps): JSX.Element;
