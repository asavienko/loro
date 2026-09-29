import { createContext, useContext } from 'react';

/** The interface's locale ("en-GB", "bg-BG", "ru-RU"), for Txt to pick faces without the store. */
export const UiLocaleContext = createContext<string>('en-GB');
export const useUiLocale = () => useContext(UiLocaleContext);
