export interface SegmentedTabsItem { value: string; label: string }
export interface SegmentedTabsProps {
  items?: SegmentedTabsItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** 'sm' = 34px (inside cards), 'md' = 40px (screen level). */
  size?: 'sm' | 'md';
}
export declare function SegmentedTabs(props: SegmentedTabsProps): JSX.Element;
