import { copy } from './copy'

/** The currently built hubs. Rails and the shared switcher consume this same declaration. */
export const DESTINATIONS = [
  {
    href: '/account',
    get label() {
      return copy.account.title
    },
    rail: false,
    counted: false,
  },
  {
    href: '/',
    get label() {
      return copy.today.title
    },
    rail: false,
    counted: false,
  },
  {
    href: '/practice/stream',
    get label() {
      return copy.today.rail.stream
    },
    rail: true,
    counted: true,
  },
  {
    href: '/practice/refrain',
    get label() {
      return copy.nav.refrain
    },
    rail: false,
    counted: false,
  },
  {
    href: '/add',
    get label() {
      return copy.today.rail.add
    },
    rail: true,
    counted: false,
  },
  {
    href: '/progress',
    get label() {
      return copy.today.rail.progress
    },
    rail: true,
    counted: false,
  },
  {
    href: '/languages',
    get label() {
      return copy.languages.title
    },
    rail: false,
    counted: false,
  },
] as const

export function placeForPath(path: string): string | undefined {
  if (path.startsWith('/phrase/')) return copy.nav.phrasePlace
  return DESTINATIONS.find((destination) => destination.href === path)?.label
}
