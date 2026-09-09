#!/usr/bin/env node
// Move plans into plans/archive/<date>/ and rebase relative Markdown / plans/ path links.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, posix as posixPath, resolve as resolvePath } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const usage =
  'Usage: node archive-plan.mjs [--date YYYY-MM-DD] [--dry-run] [--unfinished] <id-or-file>...\n'

const MD_LINK = /(!?\[(?:\\.|[^\]])*)\]\((<[^>\n]+>|[^)\s]+)(\s+(?:"[^"]*"|'[^']*'))?\)/g
const MD_REF = /^(\[[^\]]+\]:\s*)(<[^>]+>|\S+)/gm
const UNFINISHED_NOTE =
  'Archived at user request after implemented slices landed. The partial status and remaining acceptance criteria are retained; archival does not mark this plan complete. The roadmap index continues to track its unfinished scope.'

export function parseArgs(argv) {
  const rest = []
  const options = { date: '', dryRun: false, unfinished: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') options.help = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--unfinished') options.unfinished = true
    else if (arg === '--date') {
      options.date = argv[i + 1] || ''
      i += 1
    } else if (arg.startsWith('--')) {
      throw new Error(usage.trim())
    } else rest.push(arg)
  }
  return { ...options, targets: rest }
}

export function archivalDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveMoves(files, targets, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD.')
  const active = files.filter((file) => /^plans\/\d+-[^/]+\.md$/.test(file))
  const moves = new Map()
  for (const target of targets) {
    const idMatch = target.match(/^(\d+)$/)
    const wanted = idMatch
      ? active.filter((file) => file.startsWith(`plans/${idMatch[1]}-`))
      : [
          posixPath.normalize(
            target.startsWith('plans/') ? target : `plans/${posixPath.basename(target)}`,
          ),
        ]
    if (idMatch && wanted.length !== 1) {
      throw new Error(
        `Plan ${idMatch[1]} must match exactly one active file, found ${wanted.length}.`,
      )
    }
    const from = wanted[0]
    if (!active.includes(from)) throw new Error(`Not an active plan file: ${target}`)
    const to = `plans/archive/${date}/${posixPath.basename(from)}`
    if (files.includes(to)) throw new Error(`Archive target already exists: ${to}`)
    moves.set(from, to)
  }
  return moves
}

function splitHref(href) {
  const trimmed = href.startsWith('<') && href.endsWith('>') ? href.slice(1, -1) : href
  const hash = trimmed.indexOf('#')
  if (hash === -1) return { path: trimmed, fragment: '' }
  return { path: trimmed.slice(0, hash), fragment: trimmed.slice(hash) }
}

function isExternal(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)
}

function rebase(fromFile, href, newFrom, moves) {
  if (isExternal(href)) return href
  const { path, fragment } = splitHref(href)
  if (!path) return href
  const trailingSlash = path.endsWith('/') && path !== '/'
  const oldTarget = posixPath.normalize(posixPath.join(posixPath.dirname(fromFile), path))
  const newTarget = moves.get(oldTarget) ?? oldTarget
  if (fromFile === newFrom && oldTarget === newTarget) return href
  let relative = posixPath.relative(posixPath.dirname(newFrom), newTarget)
  if (!relative) relative = posixPath.basename(newTarget)
  if (trailingSlash && !relative.endsWith('/')) relative += '/'
  return relative + fragment
}

function rewriteHref(content, pattern, oldPath, newPath, moves) {
  pattern.lastIndex = 0
  return content.replace(pattern, (full, prefix, href, title = '') => {
    const next = rebase(oldPath, href, newPath, moves)
    if (next === href) return full
    const wrapped = href.startsWith('<') ? `<${next}>` : next
    return `${prefix}](${wrapped}${title})`
  })
}

function rewriteRefs(content, oldPath, newPath, moves) {
  MD_REF.lastIndex = 0
  return content.replace(MD_REF, (full, prefix, href) => {
    const next = rebase(oldPath, href, newPath, moves)
    if (next === href) return full
    const wrapped = href.startsWith('<') ? `<${next}>` : next
    return `${prefix}${wrapped}`
  })
}

function rewriteRootPaths(content, moves) {
  let next = content
  for (const [from, to] of moves) {
    const token = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(new RegExp(`(?<![A-Za-z0-9._/-])${token}(?![A-Za-z0-9._-])`, 'g'), to)
  }
  return next
}

export function insertUnfinishedNote(content, date, note = UNFINISHED_NOTE) {
  if (content.includes('**Archive disposition')) return content
  const block = `**Archive disposition (${date}):** ${note}\n\n`
  const heading = content.search(/\n## /)
  if (heading === -1) return `${content.trimEnd()}\n\n${block}`
  return `${content.slice(0, heading + 1)}${block}${content.slice(heading + 1)}`
}

export function rewriteContent({ content, oldPath, newPath, moves, unfinished, date }) {
  let next = rewriteHref(content, MD_LINK, oldPath, newPath, moves)
  next = rewriteRefs(next, oldPath, newPath, moves)
  next = rewriteRootPaths(next, moves)
  if (unfinished && moves.has(oldPath)) next = insertUnfinishedNote(next, date)
  return next
}

export function rewriteRepository(files, contents, moves, options) {
  const out = new Map()
  for (const file of files) {
    const content = contents.get(file)
    if (content === undefined) continue
    const newPath = moves.get(file) ?? file
    const rewritten = rewriteContent({
      content,
      oldPath: file,
      newPath,
      moves,
      unfinished: options.unfinished,
      date: options.date,
    })
    if (rewritten !== content || newPath !== file) out.set(newPath, rewritten)
  }
  return out
}

function gitEnv() {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  return env
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: gitEnv(),
  }).trimEnd()
}

function loadTextFiles(root, files) {
  const contents = new Map()
  for (const file of files) {
    if (file === 'AGENTS.md' || file.startsWith('design/')) continue
    if (!/\.(md|mdx|ts|tsx|js|mjs|cjs|rs|txt)$/.test(file)) continue
    contents.set(file, readFileSync(`${root}/${file}`, 'utf8'))
  }
  return contents
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(usage)
    process.stdout.write(
      'Move active plans to plans/archive/<date>/, rebase links, and print remaining index work.\n',
    )
    return 0
  }
  if (!options.targets.length) {
    process.stderr.write(usage)
    return 2
  }
  const skillDir = dirname(fileURLToPath(import.meta.url))
  const root = git(skillDir, 'rev-parse', '--show-toplevel')
  const files = git(root, 'ls-files').split('\n')
  const date = options.date || archivalDate()
  const moves = resolveMoves(files, options.targets, date)
  const contents = loadTextFiles(root, files)
  const rewritten = rewriteRepository(files, contents, moves, { ...options, date })
  if (options.dryRun) {
    for (const [from, to] of moves) process.stdout.write(`${from} -> ${to}\n`)
    process.stdout.write(`Rewrites: ${rewritten.size} files\n`)
    return 0
  }
  mkdirSync(posixPath.join(root, `plans/archive/${date}`), { recursive: true })
  execFileSync('git', ['-C', root, 'mv', ...moves.keys(), `plans/archive/${date}/`], {
    stdio: 'inherit',
    env: gitEnv(),
  })
  for (const [file, content] of rewritten) {
    writeFileSync(posixPath.join(root, file), content)
  }
  process.stdout.write(`Archived ${moves.size} plan(s) to plans/archive/${date}/\n`)
  process.stdout.write(
    'Update plans/README.md, plans/archive/README.md, the dated archive index, and CLAUDE.md status claims.\n',
  )
  return 0
}

function isCli() {
  if (!process.argv[1]) return false
  try {
    return (
      realpathSync(resolvePath(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
    )
  } catch {
    return false
  }
}

if (isCli()) {
  try {
    process.exitCode = main()
  } catch (error) {
    process.stderr.write(`${error.message.split('\n')[0]}\n`)
    process.exitCode = 1
  }
}
