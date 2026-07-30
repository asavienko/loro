import * as React from 'react';
export interface BottomSheetProps {
  open?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  /** Row of InlineActions — put the commit action left, "Done" right. */
  footer?: React.ReactNode;
}
export declare function BottomSheet(props: BottomSheetProps): JSX.Element;
