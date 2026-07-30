import * as React from 'react';
export interface ListRowProps {
  children?: React.ReactNode;
  /** Omit the top hairline for the first row in a group. */
  first?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
