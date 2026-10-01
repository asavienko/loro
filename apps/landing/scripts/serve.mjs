// Serves the landing page at http://localhost:4173 for a look on your machine: browsers won't load
// module scripts from file://. In production any static host serves this folder as it is.
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env['PORT'] ?? '4173')

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/**
 * @param {string} url
 * @param {import('node:http').ServerResponse} response
 */
async function serve(url, response) {
  try {
    const path = decodeURIComponent(new URL(url, 'http://localhost').pathname)
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path))
    const type = TYPES[extname(file)]
    if (!file.startsWith(`${root}${sep}`) || type === undefined) throw new Error('Not served')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}

createServer((request, response) => {
  void serve(request.url ?? '/', response)
}).listen(port, () => {
  console.log(`Loro's landing page: http://localhost:${port}/`)
})
