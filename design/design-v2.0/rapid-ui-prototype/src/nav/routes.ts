// Routes live in the URL hash, so a refresh keeps the learner's place and a
// set can be shared as a link. Pure: parse and format round-trip.
import type { Level, Tag } from '../content';

export type Tab = 'home' | 'explore' | 'library';

export type LibraryView = 'liked' | 'mine' | 'due' | 'learning' | 'missed' | 'learned' | 'ownSets' | 'likedSets';

export const LIBRARY_VIEWS: LibraryView[] = ['liked', 'mine', 'due', 'learning', 'missed', 'learned', 'ownSets', 'likedSets'];

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
  | { name: 'set'; id: string; from: Tab };

const LEVELS: readonly string[] = ['A1', 'A2', 'B1'];
const TAGS: readonly string[] = ['politeness', 'question', 'request', 'numbers', 'food', 'directions', 'social'];
const TABS: readonly string[] = ['home', 'explore', 'library'];

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'explore': {
      const route: Route = { name: 'explore' };
      const q = params.get('q');
      const topic = params.get('topic');
      const level = params.get('level');
      const tag = params.get('tag');
      if (q) route.q = q;
      if (topic) route.topic = topic;
      if (level && LEVELS.includes(level)) route.level = level as Level;
      if (tag && TAGS.includes(tag)) route.tag = tag as Tag;
      return route;
    }
    case 'library': {
      const view = params.get('view');
      return { name: 'library', ...(view && (LIBRARY_VIEWS as string[]).includes(view) ? { view: view as LibraryView } : {}) };
    }
    case 'set': {
      if (!parts[1]) return { name: 'home' };
      const from = params.get('from');
      return { name: 'set', id: parts[1], from: from && TABS.includes(from) ? (from as Tab) : 'home' };
    }
    default:
      return { name: 'home' };
  }
}

export function formatRoute(route: Route): string {
  const params = new URLSearchParams();
  switch (route.name) {
    case 'home':
      return '#/';
    case 'explore':
      if (route.q) params.set('q', route.q);
      if (route.topic) params.set('topic', route.topic);
      if (route.level) params.set('level', route.level);
      if (route.tag) params.set('tag', route.tag);
      return `#/explore${params.size ? `?${params}` : ''}`;
    case 'library':
      if (route.view) params.set('view', route.view);
      return `#/library${params.size ? `?${params}` : ''}`;
    case 'set':
      params.set('from', route.from);
      return `#/set/${encodeURIComponent(route.id)}?${params}`;
  }
}

/** The bottom-bar tab a route belongs to. */
export function tabOf(route: Route): Tab {
  return route.name === 'set' ? route.from : route.name;
}
