import * as React from 'react';
export interface TextAreaProps {
  value?: string;
  /** Use a real example as the placeholder: "Una caña, por favor — A beer, please". */
  placeholder?: string;
  rows?: number;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}
export declare function TextArea(props: TextAreaProps): JSX.Element;
