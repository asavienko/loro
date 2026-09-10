/**
 * Browser-only helpers passed to `page.evaluate`. Each export must stay self-contained —
 * Playwright serializes the function body, not sibling imports.
 */

/** Settle fonts, decoded images and one paint before a PNG or HTML snapshot. */
export async function prepareScreenCapture(): Promise<void> {
  await document.fonts.ready
  const decodes: Promise<unknown>[] = []
  const images = Array.from(document.images)
  for (const image of images) {
    if (typeof image.decode === 'function') decodes.push(image.decode().catch(() => undefined))
  }
  await Promise.all(decodes)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

/** Freeze the reached DOM as a portable, script-free HTML document with inlined styles. */
export async function serializeScreenHtml(): Promise<string> {
  const clone = document.documentElement.cloneNode(true) as HTMLElement

  for (const node of Array.from(
    clone.querySelectorAll(
      'script, noscript, base, link[rel="modulepreload"], link[rel="preload"], link[rel="prefetch"], link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    ),
  )) {
    node.remove()
  }

  const css: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const text = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      css.push(text.replace(/url\(\s*(['"]?)(?!data:|#)([^'")]+)\1\s*\)/gi, 'none'))
    } catch {
      // Cross-origin sheets stay out of the snapshot rather than throwing.
    }
  }

  for (const node of Array.from(clone.querySelectorAll('style, link[rel="stylesheet"]'))) {
    node.remove()
  }

  let head = clone.querySelector('head')
  if (head === null) {
    head = document.createElement('head')
    clone.prepend(head)
  }

  if (head.querySelector('meta[charset]') === null) {
    const charset = document.createElement('meta')
    charset.setAttribute('charset', 'utf-8')
    head.prepend(charset)
  }

  if (head.querySelector('meta[name="viewport"]') === null) {
    const viewport = document.createElement('meta')
    viewport.setAttribute('name', 'viewport')
    viewport.setAttribute('content', 'width=390, initial-scale=1')
    head.append(viewport)
  }

  const bundled = document.createElement('style')
  bundled.setAttribute('data-loro-screen-snapshot', '')
  bundled.textContent = [
    'html,body{margin:0;width:390px;min-height:844px;overflow:hidden}',
    css.join('\n'),
  ].join('\n')
  head.append(bundled)

  const images = Array.from(clone.querySelectorAll('img'))
  await Promise.all(
    images.map(async (image) => {
      const src = image.getAttribute('src')
      if (src === null || src === '' || src.startsWith('data:')) return
      try {
        const url = new URL(src, document.baseURI)
        if (url.origin !== location.origin) {
          image.removeAttribute('src')
          return
        }
        const response = await fetch(url)
        if (!response.ok) {
          image.removeAttribute('src')
          return
        }
        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '')
          }
          reader.onerror = () => {
            reject(reader.error ?? new Error('Could not read image bytes.'))
          }
          reader.readAsDataURL(blob)
        })
        image.setAttribute('src', dataUrl)
      } catch {
        image.removeAttribute('src')
      }
    }),
  )

  for (const el of Array.from(clone.querySelectorAll('[src], [href], [srcset], [poster]'))) {
    for (const attr of ['src', 'href', 'srcset', 'poster']) {
      const value = el.getAttribute(attr)
      if (
        value === null ||
        value === '' ||
        value.startsWith('data:') ||
        value.startsWith('#') ||
        value.startsWith('mailto:')
      )
        continue
      if (el.tagName === 'A' && attr === 'href') {
        el.setAttribute('href', '#')
        continue
      }
      el.removeAttribute(attr)
    }
  }

  for (const node of Array.from(clone.querySelectorAll('link[href]'))) {
    const href = node.getAttribute('href') ?? ''
    if (!href.startsWith('data:')) node.remove()
  }

  let lang = clone.getAttribute('lang')
  if (lang === null || lang === '') lang = document.documentElement.lang
  if (lang === '') lang = 'en'
  clone.setAttribute('lang', lang)
  // Write `<base href="./">` as text. A live `<base>` would serialize against the
  // capture server URL and break as soon as the file is copied elsewhere.
  const serialized = clone.outerHTML.replace(/<head([^>]*)>/i, '<head$1><base href="./">')
  return `<!doctype html>\n${serialized}`
}
