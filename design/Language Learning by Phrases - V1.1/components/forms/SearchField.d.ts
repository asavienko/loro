import * as React from 'react';
export interface SearchFieldProps {
  value?: string;
  placeholder?: string;
  /** Focused fields take a 1.5px accent border. */
  focused?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
