/**
 * Remove Unicode combining marks without applying product-specific token rules.
 *
 * Search and speech matching both need this exact first stage. Lowercasing, punctuation,
 * whitespace, and fuzzy matching remain the caller's responsibility because those behaviors
 * intentionally differ.
 */
export function foldDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** F-08 search: fold Latin accents, preserving meaningful Cyrillic letters such as й and ё. */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/\p{Script=Latin}\p{M}*/gu, (letter) => foldDiacritics(letter))
}
