/**
 * A static server for the PRODUCTION web export, used by `playwright.config.production.mjs`.
 *
 * Hand-written rather than a dependency, for two reasons. It is small and adds nothing to
 * the app's tree; and the fallback rule below is a decision this suite has to make
 * deliberately rather than inherit from whichever static server was convenient.
 *
 * ── The fallback rule ──
 * `expo export --platform web` emits a single `index.html` (SPA output), so every in-app
 * route has to be served by it. A blanket "always return index.html" would make a URL that
 * does not exist look like one that does, and the suite would lose the ability to tell the
 * difference. So the fallback applies only to EXTENSIONLESS paths, and anything that looks
 * like an asset — `.js`, `.png`, `.json` — 404s honestly when it is missing. That is the
 * case worth catching: an asset the dev server resolves and the export does not.
 *
 * Deep-link correctness for a real deployment is plans/46-navigation-system.md's problem,
 * not this server's.
 *
 * Run: pnpm exec tsx e2e/serveExport.ts <export-dir> [port]
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import process from 'node:process'

const [, , dirArg, portArg] = process.argv
if (dirArg === undefined) {
  console.error('usage: tsx e2e/serveExport.ts <export-dir> [port]')
  process.exit(1)
}
const root = resolve(dirArg)
const port = Number(portArg ?? 8083)

const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
}

/** Resolve inside `root` only — `normalize` collapses any `..` before the prefix check. */
function resolveInRoot(pathname: string): string | null {
  const candidate = join(root, normalize(decodeURIComponent(pathname)))
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null
}

async function fileFor(pathname: string): Promise<string | null> {
  const direct = resolveInRoot(pathname)
  if (direct !== null) {
    const found = await stat(direct).catch(() => null)
    if (found?.isFile() === true) return direct
  }
  // Extensionless means an in-app route; anything else is a missing asset and stays a 404.
  return extname(pathname) === '' ? join(root, 'index.html') : null
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  void fileFor(pathname).then((file) => {
    if (file === null) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // No caching: a rerun must serve the export it just built, not the previous one.
      'cache-control': 'no-store',
    })
    createReadStream(file).pipe(res)
  })
}

createServer(handle).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${port}`)
})
