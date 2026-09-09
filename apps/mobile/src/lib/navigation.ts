import { copy } from './copy'

/**
 * The product's routes, including authored surfaces that do not have a screen file yet.
 *
 * This is deliberately a declaration, rather than a list inferred from `app/`: a planned
 * surface must be known to navigation before it is safe to expose it, and a screen file is only
 * permitted once its declared availability becomes `built`.
 */
export const SURFACES = [
  { id: 'onboarding', path: '/onboarding', kind: 'learner', availability: 'built' },
  { id: 'add', path: '/add', kind: 'learner', availability: 'built' },
  { id: 'phrase-detail', path: '/phrase/[id]', kind: 'learner', availability: 'built' },
  { id: 'stream', path: '/practice/stream', kind: 'learner', availability: 'built' },
  { id: 'speak', path: '/practice/speak', kind: 'learner', availability: 'built' },
  { id: 'review', path: '/practice/review', kind: 'learner', availability: 'planned' },
  { id: 'roleplay', path: '/practice/roleplay', kind: 'learner', availability: 'planned' },
  { id: 'memory', path: '/memory', kind: 'learner', availability: 'planned' },
  { id: 'pronunciation', path: '/lab/pronunciation', kind: 'learner', availability: 'planned' },
  { id: 'prosody', path: '/lab/prosody', kind: 'learner', availability: 'planned' },
  { id: 'today', path: '/', kind: 'learner', availability: 'built' },
  { id: 'refrain', path: '/practice/refrain', kind: 'learner', availability: 'built' },
  { id: 'run', path: '/run', kind: 'learner', availability: 'planned' },
  { id: 'phrasebook', path: '/phrasebook', kind: 'learner', availability: 'planned' },
  { id: 'progress', path: '/progress', kind: 'learner', availability: 'built' },
  { id: 'arrival', path: '/trip/arrival', kind: 'learner', availability: 'planned' },
  { id: 'countdown', path: '/trip/countdown', kind: 'learner', availability: 'planned' },
  { id: 'daily-drop', path: '/trip/daily-drop', kind: 'learner', availability: 'planned' },
  { id: 'widget', path: '/widget', kind: 'learner', availability: 'planned' },
  { id: 'survival', path: '/survival', kind: 'learner', availability: 'planned' },
  { id: 'souvenir', path: '/souvenir', kind: 'learner', availability: 'planned' },
  { id: 'chat', path: '/chat', kind: 'learner', availability: 'planned' },
  { id: 'message-inspector', path: '/chat/message/[id]', kind: 'learner', availability: 'planned' },
  { id: 'languages', path: '/languages', kind: 'utility', availability: 'built' },
  { id: 'account', path: '/account', kind: 'utility', availability: 'built' },
  { id: 'settings', path: '/settings', kind: 'utility', availability: 'built' },
  { id: 'more', path: '/more', kind: 'utility', availability: 'built' },
  { id: 'listen-export', path: '/listen-export', kind: 'utility', availability: 'built' },
] as const

export type Surface = (typeof SURFACES)[number]
export type SurfaceId = Surface['id']
export type BuiltSurface = Extract<Surface, { availability: 'built' }>

/** `Navigation.dc.html:40–76`: every declared surface has one authored navigation law. */
export type SurfaceClass = 'root' | 'push' | 'flow' | 'session' | 'sheet'
export type ExpectedUse = 'daily' | 'often' | 'occasional' | 'setup'
export interface SurfaceLaw {
  readonly surfaceClass: SurfaceClass
  readonly expectedUse: ExpectedUse
  /** Session and flow work can be returned to without changing its target course. */
  readonly resumable: boolean
}

/**
 * Metadata remains separate from availability: a planned surface has an authored law, but it is
 * never made reachable by that fact alone. Consumers use this instead of inferring navigation
 * behaviour from a route's filename or from the current stack.
 */
export const SURFACE_LAWS: Record<SurfaceId, SurfaceLaw> = {
  onboarding: { surfaceClass: 'flow', expectedUse: 'setup', resumable: true },
  add: { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  'phrase-detail': { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  stream: { surfaceClass: 'session', expectedUse: 'daily', resumable: true },
  speak: { surfaceClass: 'session', expectedUse: 'daily', resumable: true },
  review: { surfaceClass: 'session', expectedUse: 'daily', resumable: true },
  roleplay: { surfaceClass: 'session', expectedUse: 'occasional', resumable: true },
  memory: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  pronunciation: { surfaceClass: 'session', expectedUse: 'occasional', resumable: true },
  prosody: { surfaceClass: 'session', expectedUse: 'occasional', resumable: true },
  today: { surfaceClass: 'root', expectedUse: 'daily', resumable: false },
  refrain: { surfaceClass: 'session', expectedUse: 'daily', resumable: true },
  run: { surfaceClass: 'session', expectedUse: 'occasional', resumable: true },
  phrasebook: { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  progress: { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  arrival: { surfaceClass: 'root', expectedUse: 'daily', resumable: false },
  countdown: { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  'daily-drop': { surfaceClass: 'push', expectedUse: 'daily', resumable: false },
  widget: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  survival: { surfaceClass: 'session', expectedUse: 'occasional', resumable: true },
  souvenir: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  chat: { surfaceClass: 'root', expectedUse: 'often', resumable: true },
  'message-inspector': { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  languages: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  account: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  settings: { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
  more: { surfaceClass: 'push', expectedUse: 'often', resumable: false },
  'listen-export': { surfaceClass: 'push', expectedUse: 'occasional', resumable: false },
}

export function surfaceLawForPath(path: string): SurfaceLaw | undefined {
  const surface = builtSurfaceForPath(path)
  return surface === undefined ? undefined : SURFACE_LAWS[surface.id]
}

/** A route is a safe app-relative URL, never a host URL or a malformed path. */
function appPath(input: string): string | undefined {
  if (!input.startsWith('/') || input.startsWith('//')) return undefined
  const [path] = input.split(/[?#]/, 1)
  if (!path || path.includes('\\')) return undefined
  return path
}

function matches(surface: Surface, path: string): boolean {
  const expression = `^${surface.path
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[[^/]+\\\]/g, '[^/]+')}$`
  return new RegExp(expression).test(path)
}

export function builtSurfaceForPath(input: string): BuiltSurface | undefined {
  const path = appPath(input)
  if (path === undefined) return undefined
  return SURFACES.find(
    (surface): surface is BuiltSurface =>
      surface.availability === 'built' && matches(surface, path),
  )
}

/** Onboarding remains the only first-run entry; every other deep link returns through it. */
export function conditionalHome(onboarded: boolean): '/onboarding' | '/' {
  return onboarded ? '/' : '/onboarding'
}

export type DeepLinkResolution =
  | { kind: 'built'; path: string; surface: BuiltSurface }
  | { kind: 'fallback'; path: '/onboarding' | '/'; reason: 'unknown' | 'planned' | 'malformed' }

/**
 * Resolve a user-controlled deep link without making planned screens reachable or bypassing first
 * run. The caller can use the returned `path` directly with Expo Router.
 */
export function resolveDeepLink(input: string, onboarded: boolean): DeepLinkResolution {
  const path = appPath(input)
  if (path === undefined)
    return { kind: 'fallback', path: conditionalHome(onboarded), reason: 'malformed' }

  const built = builtSurfaceForPath(path)
  if (built !== undefined) {
    if (!onboarded && built.id !== 'onboarding')
      return { kind: 'fallback', path: '/onboarding', reason: 'unknown' }
    return { kind: 'built', path, surface: built }
  }

  const planned = SURFACES.some(
    (surface) => surface.availability === 'planned' && matches(surface, path),
  )
  return {
    kind: 'fallback',
    path: conditionalHome(onboarded),
    reason: planned ? 'planned' : 'unknown',
  }
}

export const NAVIGATION_GROUPS = ['lately', 'phrases', 'practice', 'you'] as const
export type NavigationGroup = (typeof NAVIGATION_GROUPS)[number]

/**
 * The currently built hubs. Rails, the shared switcher, deep-link home behavior and More consume
 * this one declaration; planned surfaces remain declared above but cannot become destinations.
 */
export const DESTINATIONS = [
  {
    href: '/more',
    get label() {
      return copy.nav.more
    },
    rail: false,
    counted: false,
    routeClass: 'utility',
    parent: 'today',
    home: 'today',
    group: 'you',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/account',
    get label() {
      return copy.account.title
    },
    rail: false,
    counted: false,
    routeClass: 'utility',
    parent: 'today',
    home: 'today',
    group: 'you',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/settings',
    get label() {
      return copy.settings.title
    },
    rail: false,
    counted: false,
    routeClass: 'utility',
    parent: 'today',
    home: 'today',
    group: 'you',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/practice/speak',
    get label() {
      return copy.audioSpeech.speakTitle
    },
    rail: false,
    counted: false,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'practice',
    exit: 'stack-or-home',
    resume: 'practice-session',
  },
  {
    href: '/',
    get label() {
      return copy.today.title
    },
    rail: false,
    counted: false,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'lately',
    exit: 'none',
    resume: 'none',
  },
  {
    href: '/practice/stream',
    get label() {
      return copy.today.rail.stream
    },
    rail: true,
    counted: true,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'practice',
    exit: 'stack-or-home',
    resume: 'practice-session',
  },
  {
    href: '/practice/refrain',
    get label() {
      return copy.nav.refrain
    },
    rail: false,
    counted: false,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'practice',
    exit: 'stack-or-home',
    resume: 'practice-session',
  },
  {
    href: '/add',
    get label() {
      return copy.today.rail.add
    },
    rail: true,
    counted: false,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'phrases',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/progress',
    get label() {
      return copy.today.rail.progress
    },
    rail: true,
    counted: false,
    routeClass: 'learner',
    parent: 'today',
    home: 'today',
    group: 'phrases',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/languages',
    get label() {
      return copy.languages.title
    },
    rail: false,
    counted: false,
    routeClass: 'utility',
    parent: 'today',
    home: 'today',
    group: 'you',
    exit: 'stack-or-home',
    resume: 'none',
  },
  {
    href: '/listen-export',
    get label() {
      return copy.nav.listenExport
    },
    rail: false,
    counted: false,
    routeClass: 'utility',
    parent: 'today',
    home: 'today',
    group: 'phrases',
    exit: 'stack-or-home',
    resume: 'none',
  },
] as const

export function destinationsForGroup(group: NavigationGroup) {
  return DESTINATIONS.filter(
    (destination) =>
      destination.group === group && destination.href !== '/' && destination.href !== '/more',
  )
}

export function placeForPath(path: string): string | undefined {
  if (builtSurfaceForPath(path)?.id === 'phrase-detail') return copy.nav.phrasePlace
  return DESTINATIONS.find((destination) => destination.href === path)?.label
}
