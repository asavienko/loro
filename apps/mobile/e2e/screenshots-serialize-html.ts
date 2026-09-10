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

/** Freeze the reached DOM as a script-free HTML document with inlined styles. */
export async function serializeScreenHtml(): Promise<string> {
  const clone = document.documentElement.cloneNode(true) as HTMLElement

  for (const node of Array.from(
    clone.querySelectorAll(
      'script, noscript, link[rel="modulepreload"], link[rel="preload"][as="script"], link[rel="prefetch"]',
    ),
  )) {
    node.remove()
  }

  const css: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css.push(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n'),
      )
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
        if (url.origin !== location.origin) return
        const response = await fetch(url)
        if (!response.ok) return
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
        // Leave the original src; the snapshot still contains the markup.
      }
    }),
  )

  let lang = clone.getAttribute('lang')
  if (lang === null || lang === '') lang = document.documentElement.lang
  if (lang === '') lang = 'en'
  clone.setAttribute('lang', lang)
  return `<!doctype html>\n${clone.outerHTML}`
}
