/** Stable capture filenames shared by the Playwright writer and the Node reporter. */
export function filenameFor(name, extension = 'png') {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619)
  return `${slug || 'state'}-${(hash >>> 0).toString(16).padStart(8, '0')}.${extension}`
}
