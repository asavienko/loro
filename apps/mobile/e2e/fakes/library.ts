// The library routes of the fake API (apps/api/src/library): sets, phrases, albums, songs, lyrics,
// covers, saves, sharing, Community, reports, push tokens and deleting an account.
import { json, type Route } from './api';

export const libraryRoutes: Route[] = [
  // A set's songs and the albums they are in.
  { method: 'GET', pattern: '/library/sets/:id/songs', handler: () => json({ songs: [], albums: [] }) },
];
