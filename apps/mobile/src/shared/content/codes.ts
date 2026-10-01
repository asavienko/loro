// The language codes the app is built to handle (its copy, its types). Which of them the server
// teaches and speaks in, with their flags, comes from the API (GET /library/languages, plan 108).
export const LANGUAGE_CODES = ['en-GB', 'en-US', 'es-ES', 'bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ'] as const;
export const UI_LOCALES = ['en', 'bg', 'ru', 'pl', 'cs'] as const;

/** Two codes of one language (en-GB and en-US): a speaker of one never takes a course in the other. */
export function sameLanguage(a: string, b: string): boolean {
  return a.split('-')[0] === b.split('-')[0];
}

/** The language a bank phrase's id names: "us" for American English, else the code's language. */
export function idLanguage(code: string): string {
  return code === 'en-US' ? 'us' : code.slice(0, 2);
}
