// Routes live in the URL hash, so a refresh keeps the learner's place and a
// set can be shared as a link. Pure: parse and format round-trip.
import { TOPICS, type Level, type Tag } from '../content';

/** The bottom bar: Home, Explore (sets of phrases and songs), Create and Library (plan 107). */
export type Tab = 'home' | 'explore' | 'create' | 'library';

/** Library's lists; `albums` holds Loro's, the learner's and shared albums (plan 107). */
export type LibraryView = 'liked' | 'mine' | 'due' | 'learning' | 'missed' | 'learned' | 'ownSets' | 'likedSets' | 'albums';

export const LIBRARY_VIEWS: LibraryView[] = ['liked', 'mine', 'due', 'learning', 'missed', 'learned', 'ownSets', 'likedSets', 'albums'];

export interface ExploreFilters {
  q?: string;
  topic?: string;
  level?: Level;
  tag?: Tag;
}

export type Route =
  | { name: 'home' }
  | ({ name: 'explore' } & ExploreFilters)
  | { name: 'library'; view?: LibraryView }
  | { name: 'create' }
  | { name: 'set'; id: string; from: Tab }
  | { name: 'album'; id: string; from: Tab };

const LEVELS: readonly string[] = ['A1', 'A2', 'B1'];
const TAGS: readonly string[] = ['politeness', 'question', 'request', 'numbers', 'food', 'directions', 'social'];
const TABS: readonly string[] = ['home', 'explore', 'create', 'library'];

/** A malformed escape (a stray "%" in a pasted link) is kept as typed rather than throwing. */
function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean).map(safeDecode);
  switch (parts[0]) {
    case 'explore': {
      const route: Route = { name: 'explore' };
      const q = params.get('q');
      const topic = params.get('topic');
      const level = params.get('level');
      const tag = params.get('tag');
      if (q) route.q = q;
      // An unknown topic would filter everything out behind a heading that says "All sets".
      if (topic && TOPICS.some((t) => t.id === topic)) route.topic = topic;
      if (level && LEVELS.includes(level)) route.level = level as Level;
      if (tag && TAGS.includes(tag)) route.tag = tag as Tag;
      return route;
    }
    case 'library': {
      const view = params.get('view');
      return { name: 'library', ...(view && (LIBRARY_VIEWS as string[]).includes(view) ? { view: view as LibraryView } : {}) };
    }
    // The Music tab's links (plan 106) open Library's albums.
    case 'music':
      return { name: 'library', view: 'albums' };
    case 'create':
      return { name: 'create' };
    case 'set':
    case 'album': {
      if (!parts[1]) return { name: 'home' };
      const from = params.get('from');
      const tab = from && TABS.includes(from) ? (from as Tab) : parts[0] === 'album' ? 'library' : 'home';
      return { name: parts[0], id: parts[1], from: tab };
    }
    default:
      return { name: 'home' };
  }
}

export function formatRoute(route: Route): string {
  const params = new URLSearchParams();
  // The query as text: the URLSearchParams Expo installs on iOS and Android has no `size`.
  const query = () => params.toString();
  switch (route.name) {
    case 'home':
      return '#/';
    case 'explore':
      if (route.q) params.set('q', route.q);
      if (route.topic) params.set('topic', route.topic);
      if (route.level) params.set('level', route.level);
      if (route.tag) params.set('tag', route.tag);
      return `#/explore${query() ? `?${query()}` : ''}`;
    case 'library':
      if (route.view) params.set('view', route.view);
      return `#/library${query() ? `?${query()}` : ''}`;
    case 'create':
      return '#/create';
    case 'set':
    case 'album':
      params.set('from', route.from);
      return `#/${route.name}/${encodeURIComponent(route.id)}?${params}`;
  }
}

/** The bottom-bar tab a route belongs to. */
export function tabOf(route: Route): Tab {
  return route.name === 'set' || route.name === 'album' ? route.from : route.name;
}
