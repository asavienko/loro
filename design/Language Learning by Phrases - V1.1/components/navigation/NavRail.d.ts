import * as React from 'react';
export interface RailItem {
  label: string;
  /** A due count, not a badge — omit when there is nothing to count. */
  count?: number | string;
  active?: boolean;
  onClick?: () => void;
}
export interface NavRailProps {
  items?: RailItem[];
  onMore?: () => void;
  style?: React.CSSProperties;
}
export declare function NavRail(props: NavRailProps): JSX.Element;
