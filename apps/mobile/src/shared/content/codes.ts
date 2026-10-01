// The language codes the app is built to handle (its copy, its types). Which of them the server
// teaches and speaks in, with their flags, comes from the API (GET /library/languages, plan 108).
export const LANGUAGE_CODES = ['en-GB', 'es-ES', 'bg-BG', 'ru-RU'] as const;
export const UI_LOCALES = ['en', 'bg', 'ru'] as const;
