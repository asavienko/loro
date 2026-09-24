/** Plural forms by CLDR category; `other` is required, the rest are per language. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export function pluralFor(locale: string) {
  const rules = new Intl.PluralRules(locale);
  return (count: number, forms: PluralForms): string => forms[rules.select(count)] ?? forms.other;
}
