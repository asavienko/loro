// The library routes of the fake API (apps/api/src/library): sets, phrases, albums, songs, lyrics,
// covers, saves, sharing, Community, reports, push tokens and deleting an account. Everything is kept
// in memory in `api.store.lib`; the status codes, problem codes, visibility rules and allowances are
// the real API's, its SQL and its models are not.
//
// Work the real server does in the background (a cover drawn, lyrics written, a song sung, a deck
// written) is `rendering` when it is asked for and finishes after the app has asked after it
// `lib.config.*Polls` times, or when a test says so (`readySong`, `readyCover`, …). `lib.config.ai`
// says whether the server has a text model: with none the labelled fallbacks answer at once, as a
// server without keys does.
import { FIXTURE, fixturePack } from '@shared/content/fixture';
import type { LanguageCode } from '@shared/content';
import { DEFAULT_SONG_OPTIONS, SONG_LENGTH_LINES, SONG_LENGTHS, SONG_MOODS, SONG_STYLES, SONG_TEMPOS, SONG_VOICES, type SongOptions } from '@shared/api/library';
import { clipsFor, json, newId, noContent, problem, type FakeApi, type Reply, type Request, type Route, type User } from './api';
import { audio } from './audio';

type Visibility = 'private' | 'link' | 'public';
type CoverKind = 'set' | 'album' | 'song' | 'phrase';
type Level = 'A1' | 'A2' | 'B1';
type Wire = any;

const VISIBILITIES = ['private', 'link', 'public'];
const LEVELS = ['A1', 'A2', 'B1'];
const COVER_KINDS = ['set', 'album', 'song', 'phrase'];
const SOURCES = ['ai', 'bank', 'course', 'written'];
const MAX_SET_PHRASES = 40;
/** Reports that take a public item out of Community. */
const REPORTS_TO_HIDE = 3;
const COMMUNITY_PAGE = 50;
const MORE_BY_MAKER = 12;
const COVER_HISTORY_LIMIT = 24;
const DAY_MS = 86_400_000;
/** How long a lyric line plays in the demo song's bars. */
const LINE_MS = 4000;

// ---------- state ----------

export interface SetRec {
  id: string;
  /** Null for Loro's own. */
  ownerId: string | null;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  title: string;
  subtitle: Record<string, string> | null;
  description: string | null;
  topicId: string;
  level: Level;
  coverIcon: string;
  coverId: string | null;
  visibility: Visibility;
  shareCode: string;
  inbox: boolean;
  /** The phrases it lists, held by it or by another set of its owner's. */
  items: string[];
  createdAt: number;
  updatedAt: number;
  /** Order of the last change, for "newest first" when the clock stands still. */
  rev: number;
}

export interface PhraseRec {
  id: string;
  /** The set holding it. */
  setId: string;
  target: string;
  translations: Partial<Record<string, string>>;
  image: string[];
  notes: Wire;
  noteTranslations: Wire;
  source: string;
  notesBy?: 'ai' | 'rules';
}

export interface AlbumRec {
  id: string;
  ownerId: string;
  targetLang: LanguageCode;
  title: string;
  description: string | null;
  coverId: string | null;
  visibility: Visibility;
  shareCode: string;
  createdAt: number;
  updatedAt: number;
  rev: number;
}

interface Line {
  text: string;
  meaning: string;
  phraseId: string | null;
}
interface Section {
  name: 'verse' | 'chorus' | 'bridge';
  lines: Line[];
}

export interface SongRec {
  id: string;
  albumId: string;
  ownerId: string;
  setId: string;
  title: string;
  styleId: string;
  status: 'rendering' | 'ready' | 'failed';
  /** The lyrics it will be sung from (the learner's approved ones, or written for it). */
  lyrics: Section[];
  sections: Wire[];
  lyricsBy: 'ai' | 'phrases';
  audio: boolean;
  /**
   * How it sounds once ready: the server's demo instrumental with its voice (no music provider), or
   * sung by ElevenLabs and, where transcription is set up, heard back for its lines' timings.
   */
  sound: { by: 'elevenlabs' | 'demo'; voiced: boolean; timing: 'transcript' | 'demo' | null };
  options: SongOptions;
  error: string | null;
  createdAt: number;
  /** How many times the app asked after it while it was rendering. */
  polls: number;
  rev: number;
}

export interface CoverRec {
  id: string;
  ownerId: string | null;
  provider: 'ai' | 'pattern';
  status: 'rendering' | 'ready' | 'failed';
  /** What it was drawn for, so it can be chosen again. */
  itemKind: CoverKind | null;
  itemId: string | null;
  prompt: string | null;
  createdAt: number;
  seq: number;
  polls: number;
  /** Where it goes once ready. */
  place: { kind: CoverKind; id: string } | null;
}

interface LyricsRec {
  id: string;
  ownerId: string;
  setId: string;
  styleId: string;
  title: string;
  status: 'writing' | 'ready' | 'failed';
  sections: Section[] | null;
  lyricsBy: 'ai' | 'phrases' | null;
  revision: number;
  instruction: string | null;
  options: SongOptions;
  nativeLang: LanguageCode;
  updatedAt: number;
  polls: number;
}

interface DeckRec {
  id: string;
  ownerId: string;
  status: 'writing' | 'ready' | 'failed';
  result: Wire | null;
  polls: number;
}

export interface Lib {
  sets: Map<string, SetRec>;
  phrases: Map<string, PhraseRec>;
  albums: Map<string, AlbumRec>;
  songs: Map<string, SongRec>;
  covers: Map<string, CoverRec>;
  lyrics: Map<string, LyricsRec>;
  decks: Map<string, DeckRec>;
  /** `user|set|id` and `user|album|id` of what a learner saved. */
  saves: Set<string>;
  /** `user|kind|id` → reason, one report per learner per item. */
  reports: Map<string, string>;
  /** `user|phrase|id` and `user|song|id` → the cover that learner gave it. */
  itemCovers: Map<string, string>;
  pushTokens: Map<string, { userId: string; lang: string; platform?: string }>;
  config: {
    /** The server has a text model: covers, lyrics and decks are written in the background. */
    ai: boolean;
    /** How many times the app asks after a thing still being made before it is ready. */
    coverPolls: number;
    lyricsPolls: number;
    deckPolls: number;
    /** `Infinity`: a song is ready only when a test says so (`readySong`). */
    songPolls: number;
  };
  seq: number;
}

/** The library's state in `api.store.lib`, made the first time. */
export function lib(api: FakeApi): Lib {
  api.store.lib ??= {
    sets: new Map(),
    phrases: new Map(),
    albums: new Map(),
    songs: new Map(),
    covers: new Map(),
    lyrics: new Map(),
    decks: new Map(),
    saves: new Set(),
    reports: new Map(),
    itemCovers: new Map(),
    pushTokens: new Map(),
    config: { ai: true, coverPolls: 0, lyricsPolls: 0, deckPolls: 0, songPolls: 1 },
    seq: 0,
  } satisfies Lib;
  return api.store.lib as Lib;
}

/** A change to the library: the pack's version moves with it. */
function bump(api: FakeApi): number {
  api.store.revision = (api.store.revision ?? 0) + 1;
  return ++lib(api).seq;
}

const now = () => Date.now();
const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

// ---------- refusing ----------

/** An answer thrown to end a handler, as the service throws a `LoroError`. */
class Refusal extends Error {
  constructor(readonly reply: Reply) {
    super(String(reply.status));
  }
}
const notFound = () => new Refusal(problem(404, 'NOT_FOUND', 'Not found'));
const invalid = (detail: string) => new Refusal(problem(422, 'VALIDATION_FAILED', detail));
const unavailable = (detail: string) => new Refusal(problem(503, 'PROVIDER_UNAVAILABLE', detail));
const limited = (kind: string, limit: number, resetsAt: number | null, detail: string) =>
  new Refusal({
    status: 429,
    body: { type: 'about:blank', title: 'Allowance used', status: 429, code: 'LIMIT_REACHED', detail, kind, limit, resets_at: resetsAt },
  });

// ---------- validation (the shapes of packages/core/src/api/library.ts) ----------

type Check = (value: unknown) => string | null;

const LINK_SCHEME = /https?:\/\/|\bwww\./i;
const LINK_DOMAIN = /\b[a-z0-9-]{2,}\.(?:com|net|org|io|ru|xyz|info|biz|top|link|click)(?=[\s/:?#)]|$)/;
/** Whether text holds a link: nothing a learner names or describes may. */
const hasLink = (text: string) => LINK_SCHEME.test(text) || LINK_DOMAIN.test(text.replace(/\.(?=[A-Z])/g, '. ').toLowerCase());

/** Text of `min`..`max` characters once trimmed; other learners read it, so no links. */
const text =
  (max: number, min = 0, links = false): Check =>
  (v) => {
    if (typeof v !== 'string') return 'expected text';
    const t = v.trim();
    if (t.length < min || t.length > max) return `needs ${min} to ${max} characters`;
    return !links && hasLink(t) ? 'Links are not allowed here' : null;
  };
const oneOf =
  (values: readonly string[]): Check =>
  (v) =>
    typeof v === 'string' && values.includes(v) ? null : `expected one of ${values.join(', ')}`;
const matches =
  (pattern: RegExp): Check =>
  (v) =>
    typeof v === 'string' && pattern.test(v) ? null : 'wrong format';
const id: Check = (v) => (typeof v === 'string' && /^[a-z0-9][a-z0-9.-]{2,95}$/.test(v) && !v.includes('..') ? null : 'not an id');
const list =
  (max: number, item: Check, min = 0): Check =>
  (v) => {
    if (!Array.isArray(v)) return 'expected a list';
    if (v.length < min || v.length > max) return `needs ${min} to ${max} items`;
    for (const entry of v) {
      const bad = item(entry);
      if (bad) return bad;
    }
    return null;
  };
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null ? null : check(v);
const int =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? null : `expected a whole number ${min} to ${max}`;

/** A strict object: no other keys, the `required` ones present, each key's own check. */
function check(body: unknown, shape: Record<string, Check>, required: string[] = []): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'expected an object';
  const given = body as Record<string, unknown>;
  for (const key of Object.keys(given)) if (!(key in shape)) return `unrecognised key ${key}`;
  for (const key of required) if (given[key] === undefined) return `${key} is required`;
  for (const [key, one] of Object.entries(shape)) {
    if (given[key] === undefined) continue;
    const bad = one(given[key]);
    if (bad) return `${key}: ${bad}`;
  }
  return null;
}

/** Throws a 422 unless `body` fits `shape`. */
function parse(body: unknown, shape: Record<string, Check>, required: string[] = []): any {
  const bad = check(body, shape, required);
  if (bad) throw invalid(bad);
  return body;
}

const shape =
  (fields: Record<string, Check>, required: string[] = []): Check =>
  (v) =>
    check(v, fields, required);

const courses = FIXTURE.languages.filter((l) => l.canTarget).map((l) => l.code);
const languages = FIXTURE.languages.map((l) => l.code);
const course = oneOf(courses);
const language = oneOf(languages);
const sameLanguage = (a: string, b: string) => a.split('-')[0] === b.split('-')[0];
/** A course is never in the learner's own language. */
const apart = (target: string, native: string) => {
  if (sameLanguage(target, native)) throw invalid('A course is never in the learner’s own language');
};

const noteShape = { title: text(60, 1), text: text(300, 1) };
const notesCheck = shape(
  {
    mnemonic: shape(noteShape, ['title', 'text']),
    grammar: shape(noteShape, ['title', 'text']),
    pronunciation: shape({ ...noteShape, ipa: text(300, 3), respelling: text(300, 1) }, ['title', 'text', 'ipa', 'respelling']),
  },
  ['mnemonic', 'grammar', 'pronunciation'],
);
const iconList = list(3, matches(/^[a-z0-9_]{1,40}$/), 1);
const NEW_PHRASE = {
  id: matches(/^mine-p-[a-z0-9][a-z0-9.-]{2,80}$/),
  target: text(120, 1, true),
  native: text(120, 1, true),
  image: iconList,
  notes: notesCheck,
  notesBy: oneOf(['ai', 'rules']),
  source: oneOf(SOURCES),
  bankId: matches(/^bank-[a-z0-9-]{3,60}$/),
};
const setItem: Check = (v) =>
  typeof v === 'object' && v !== null && 'ref' in v ? check(v, { ref: id }, ['ref']) : check(v, NEW_PHRASE, ['target', 'native', 'source']);
const options = shape({
  voice: oneOf(SONG_VOICES),
  tempo: oneOf(SONG_TEMPOS),
  mood: nullable(oneOf(SONG_MOODS)),
  length: oneOf(SONG_LENGTHS),
  theme: nullable(text(200)),
});

// ---------- Loro's own content (the fixture), read-only ----------

let loroCache: { sets: Map<string, SetRec>; phrases: Map<string, Wire> } | null = null;

/** Loro's sets and phrases, as every course's pack serves them. */
function loro() {
  if (loroCache) return loroCache;
  const sets = new Map<string, SetRec>();
  const phrases = new Map<string, Wire>();
  for (const code of courses) {
    const pack = fixturePack(code);
    for (const phrase of pack.phrases) phrases.set(phrase.id, { ...phrase, audio: clipsFor(phrase, code) });
    for (const set of pack.sets) {
      sets.set(set.id, {
        id: set.id,
        ownerId: null,
        targetLang: set.targetLang,
        nativeLang: 'en-GB',
        title: set.title,
        subtitle: set.subtitle as Record<string, string>,
        description: null,
        topicId: set.topicId,
        level: set.level,
        coverIcon: set.coverIcon,
        coverId: null,
        visibility: 'public',
        shareCode: shareCodeOf(set.id),
        inbox: false,
        items: [...set.phraseIds],
        createdAt: 0,
        updatedAt: 0,
        rev: 0,
      });
    }
  }
  loroCache = { sets, phrases };
  return loroCache;
}

/** A stable ten-character code for an id, lower-case letters and digits. */
function shareCodeOf(key: string): string {
  let h = 7;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
  return `lo${h.toString(36).padStart(8, '0')}`.slice(0, 10);
}

let shareSerial = 0;
/** A new share code: ten characters, unique within the run. */
const newShareCode = () => `s${(++shareSerial).toString(36).padStart(9, '0')}`;

// ---------- reading ----------

const keyOf = (userId: string | null, kind: string, itemId: string) => `${userId ?? ''}|${kind}|${itemId}`;

type Readable = { ownerId: string | null; visibility: Visibility };
const canRead = (row: Readable, userId: string | null) => row.ownerId === null || row.visibility !== 'private' || (userId !== null && row.ownerId === userId);
const ownerOf = (row: { ownerId: string | null }, userId: string | null) => (row.ownerId === null ? 'loro' : row.ownerId === userId ? 'me' : 'other');

const findSet = (l: Lib, setId: string): SetRec | undefined => l.sets.get(setId) ?? loro().sets.get(setId);
function readableSet(l: Lib, userId: string | null, setId: string): SetRec {
  const row = findSet(l, setId);
  if (!row || !canRead(row, userId)) throw notFound();
  return row;
}
function readableAlbum(l: Lib, userId: string | null, albumId: string): AlbumRec {
  const row = l.albums.get(albumId);
  if (!row || !canRead(row, userId)) throw notFound();
  return row;
}
/** The learner's own set; someone else's is not found rather than forbidden. */
function ownSet(l: Lib, userId: string, setId: string): SetRec {
  const row = l.sets.get(setId);
  if (row?.ownerId !== userId) throw notFound();
  return row;
}
function ownAlbum(l: Lib, userId: string, albumId: string): AlbumRec {
  const row = l.albums.get(albumId);
  if (row?.ownerId !== userId) throw notFound();
  return row;
}
function ownSong(l: Lib, userId: string, songId: string): SongRec {
  const row = l.songs.get(songId);
  if (!row) throw notFound();
  ownAlbum(l, userId, row.albumId);
  return row;
}
function ownDraft(l: Lib, userId: string, draftId: string): LyricsRec {
  const row = l.lyrics.get(draftId);
  if (row?.ownerId !== userId) throw notFound();
  return row;
}

const reportsOf = (l: Lib, kind: 'set' | 'album', itemId: string) => [...l.reports.keys()].filter((k) => k.endsWith(`|${kind}|${itemId}`)).length;
const hiddenFromCommunity = (l: Lib, kind: 'set' | 'album', itemId: string) => reportsOf(l, kind, itemId) >= REPORTS_TO_HIDE;
const savedBy = (l: Lib, kind: 'set' | 'album', row: { id: string; ownerId: string | null }) =>
  [...l.saves].filter((k) => k.endsWith(`|${kind}|${row.id}`) && !k.startsWith(`${row.ownerId}|`)).length;

/** The phrase as the app reads it: a learner's, or one of Loro's. */
function phraseWire(l: Lib, phraseId: string): Wire | undefined {
  const own = l.phrases.get(phraseId);
  if (!own) return loro().phrases.get(phraseId);
  const set = l.sets.get(own.setId)!;
  return {
    id: own.id,
    setId: own.setId,
    target: own.target,
    translations: own.translations,
    register: 'neutral',
    region: '',
    tags: [],
    image: own.image,
    words: {},
    notes: own.notes,
    noteTranslations: own.noteTranslations,
    source: own.source,
    ...(own.notesBy ? { notesBy: own.notesBy } : {}),
    audio: clipsFor(own, set.targetLang),
  };
}

/** A set's phrases, each once. */
const phrasesOfSet = (l: Lib, set: SetRec): Wire[] => [...new Set(set.items)].flatMap((p) => phraseWire(l, p) ?? []);
const phrasesOfSets = (l: Lib, sets: SetRec[]): Wire[] => {
  const seen = new Set<string>();
  return sets.flatMap((s) => phrasesOfSet(l, s)).filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)));
};

const coverPath = (coverId: string | null) => (coverId ? `/library/covers/${coverId}.svg` : null);
const profileName = (api: FakeApi, userId: string | null) => (userId ? (api.users.get(userId)?.displayName ?? null) : null);

function songCountOf(l: Lib, set: SetRec): number {
  return [...l.songs.values()].filter((s) => {
    if (s.setId !== set.id || s.status !== 'ready') return false;
    const album = l.albums.get(s.albumId);
    return album !== undefined && (album.visibility === 'public' || album.ownerId === set.ownerId);
  }).length;
}

function setWire(api: FakeApi, l: Lib, row: SetRec, userId: string | null): Wire {
  const owner = ownerOf(row, userId);
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    topicId: row.topicId,
    level: row.level,
    coverIcon: row.coverIcon,
    coverUrl: coverPath(row.coverId),
    targetLang: row.targetLang,
    phraseIds: [...new Set(row.items)],
    songCount: songCountOf(l, row),
    owner,
    author: row.ownerId === null ? null : profileName(api, row.ownerId),
    visibility: row.visibility,
    shareCode: owner === 'me' || row.visibility !== 'private' ? row.shareCode : null,
    saved: l.saves.has(keyOf(userId, 'set', row.id)),
    ...(row.inbox && owner === 'me' ? { inbox: true } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function albumWire(api: FakeApi, l: Lib, row: AlbumRec, userId: string | null): Wire {
  const owner = ownerOf(row, userId);
  const songs = [...l.songs.values()].filter((s) => s.albumId === row.id && s.status === 'ready');
  const durations = songs.map((s) => songLength(s));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: coverPath(row.coverId),
    targetLang: row.targetLang,
    owner,
    author: profileName(api, row.ownerId),
    visibility: row.visibility,
    shareCode: owner === 'me' || row.visibility !== 'private' ? row.shareCode : null,
    saved: l.saves.has(keyOf(userId, 'album', row.id)),
    songCount: songs.length,
    durationMs: durations.every((d) => d !== null) ? durations.reduce<number>((sum, d) => sum + (d ?? 0), 0) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** A ready song is as long as its lines play in the demo's bars. */
const songLength = (s: SongRec): number | null => (s.status === 'ready' ? Math.max(1, s.lyrics.flatMap((x) => x.lines).length) * LINE_MS : null);

function songWire(s: SongRec): Wire {
  // The player hears the song as long as the server says it is.
  const length = songLength(s);
  if (s.audio && length !== null) audio.lengths.set(`/library/songs/${s.id}/audio`, length);
  return {
    id: s.id,
    albumId: s.albumId,
    setId: s.setId,
    title: s.title,
    styleId: s.styleId,
    status: s.status,
    sections: s.sections,
    lyricsBy: s.lyricsBy,
    audioUrl: s.audio ? `/library/songs/${s.id}/audio?exp=${now() + 12 * 3_600_000}&sig=e2e` : null,
    audioBy: s.audio ? s.sound.by : null,
    voiced: s.audio && s.sound.voiced,
    timingBy: s.audio ? s.sound.timing : null,
    options: s.options,
    durationMs: songLength(s),
    error: s.error,
    createdAt: s.createdAt,
  };
}

const songsOfAlbum = (l: Lib, albumId: string) => [...l.songs.values()].filter((s) => s.albumId === albumId).map((s) => songWire(s));

const setDetail = (api: FakeApi, l: Lib, row: SetRec, userId: string | null) => ({ set: setWire(api, l, row, userId), phrases: phrasesOfSet(l, row) });
const albumDetail = (api: FakeApi, l: Lib, row: AlbumRec, userId: string | null) => ({ album: albumWire(api, l, row, userId), songs: songsOfAlbum(l, row.id) });

// ---------- allowances ----------

function resetsAt(): number {
  return Date.parse(`${utcDay(now())}T00:00:00Z`) + DAY_MS;
}

/** Counts one use of today's allowance, or refuses as the API does. */
function spend(api: FakeApi, user: User, kind: 'phrases' | 'cover' | 'song' | 'lyrics'): void {
  const limit = api.limits[kind];
  if (limit <= 0) throw limited(kind, limit, resetsAt(), `${kind} generation is off`);
  if (!api.spend(user.id, kind)) throw limited(kind, limit, resetsAt(), `Daily ${kind} allowance used`);
}

const keptCount = (l: Lib, userId: string, kind: 'sets' | 'albums' | 'songs') =>
  [...(kind === 'sets' ? l.sets : kind === 'albums' ? l.albums : l.songs).values()].filter((r) => r.ownerId === userId).length;

function assertKept(api: FakeApi, l: Lib, userId: string, kind: 'sets' | 'albums' | 'songs', extra = 0): void {
  const limit = api.kept[kind];
  if (keptCount(l, userId, kind) + Math.max(extra, 1) > limit) throw limited(kind, limit, null, `At most ${limit} ${kind}`);
}

// ---------- writing: sets and phrases ----------

type NewItem = { ref: string } | { id?: string; target: string; native: string; image?: string[]; notes?: Wire; notesBy?: 'ai' | 'rules'; source: string; bankId?: string };

/** Notes and a picture for a phrase by Loro's rules: the same for any words, labelled as the rules'. */
function ruleNotes(target: string, native: string): { image: string[]; notes: Wire } {
  const sounds = target.toLowerCase();
  return {
    image: ['edit_note'],
    notes: {
      mnemonic: { title: 'A hook', text: `Say “${target}” and picture “${native}”.` },
      grammar: { title: 'In use', text: `“${target}” is how to say “${native}”.` },
      pronunciation: { title: 'Sounds', ipa: `[${sounds}]`, respelling: sounds, text: 'Say it slowly, then at speed.' },
    },
  };
}

const holderOf = (l: Lib, phraseId: string): SetRec | undefined => {
  const held = l.phrases.get(phraseId);
  if (held) return l.sets.get(held.setId);
  const loroPhrase = loro().phrases.get(phraseId);
  return loroPhrase ? loro().sets.get(loroPhrase.setId) : undefined;
};

/** Puts items at the end of a learner's set: references to phrases held elsewhere, or new phrases it holds. */
function insertItems(l: Lib, set: SetRec, ownerId: string, items: NewItem[]): void {
  const stem = set.id.replace(/^set-u-/, 'u').replace(/^mine-s-/, 'u');
  const taken = new Set([...l.phrases.values()].filter((p) => p.setId === set.id).map((p) => p.id));
  let serial = 1;
  for (const item of items) {
    const known = 'ref' in item ? item.ref : item.id;
    const holder = known ? holderOf(l, known) : undefined;
    const listable = holder !== undefined && holder.targetLang === set.targetLang && (holder.ownerId === null || holder.ownerId === ownerId);
    if ('ref' in item || (known && listable)) {
      if (!known || !listable) throw invalid('Unknown phrase');
      if (holder.id !== set.id && !set.items.includes(known)) set.items.push(known);
      continue;
    }
    let phraseId = item.id && !holder ? item.id : '';
    while (!phraseId) {
      const candidate = `${stem}-${String(serial++).padStart(2, '0')}`;
      if (!taken.has(candidate) && !l.phrases.has(candidate)) phraseId = candidate;
    }
    taken.add(phraseId);
    const bank = item.source === 'bank' && item.bankId ? FIXTURE.bank.phrases.find((b) => b.id === item.bankId) : undefined;
    const given = item.notes && item.image ? { notes: item.notes, image: item.image, notesBy: item.notesBy } : { ...ruleNotes(item.target, item.native), notesBy: 'rules' as const };
    const noteTranslations = bank
      ? Object.fromEntries((['mnemonic', 'grammar', 'pronunciation'] as const).flatMap((kind) => (FIXTURE.bankNoteTranslations[`${bank.id}.${kind}`] ? [[kind, FIXTURE.bankNoteTranslations[`${bank.id}.${kind}`]]] : [])))
      : {};
    l.phrases.set(phraseId, {
      id: phraseId,
      setId: set.id,
      target: item.target,
      translations: { [set.nativeLang]: item.native },
      image: bank ? [...bank.image] : given.image,
      notes: bank ? bank.notes : given.notes,
      noteTranslations,
      source: item.source,
      ...(!bank && given.notesBy ? { notesBy: given.notesBy } : {}),
    });
    set.items.push(phraseId);
  }
}

/** Takes phrases out of a set; one it held that another of its owner's sets lists moves there. */
function removeItems(l: Lib, set: SetRec, phraseIds: string[]): void {
  for (const phraseId of phraseIds) {
    set.items = set.items.filter((p) => p !== phraseId);
    const held = l.phrases.get(phraseId);
    if (held?.setId !== set.id) continue;
    const elsewhere = [...l.sets.values()].filter((s) => s.id !== set.id && s.items.includes(phraseId)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (elsewhere) held.setId = elsewhere.id;
    else l.phrases.delete(phraseId);
  }
}

function newSetId(): string {
  return `set-u-${newId().slice(-12)}`;
}

interface SetInput {
  id?: string;
  title: string;
  description?: string | null;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  level?: Level;
  topicId?: string;
  coverIcon?: string;
  coverId?: string | null;
  visibility?: Visibility;
  inbox?: boolean;
  items: NewItem[];
  subtitle?: Record<string, string> | null;
}

/** Makes a learner's set (kept limit not checked): the route's, a copy's and the seeding helpers'. */
function makeSet(api: FakeApi, l: Lib, ownerId: string, input: SetInput): SetRec {
  const rev = bump(api);
  const at = now();
  const topicId = input.topicId && FIXTURE.topics.some((t) => t.id === input.topicId) ? input.topicId : 'everyday';
  const firstIcon = input.items.flatMap((i) => ('ref' in i ? [] : (i.image ?? [])))[0];
  const setId = input.id && !findSet(l, input.id) ? input.id : newSetId();
  const set: SetRec = {
    id: setId,
    ownerId,
    targetLang: input.targetLang,
    nativeLang: input.nativeLang,
    title: input.title,
    subtitle: input.subtitle ?? null,
    description: blankToNull(input.description),
    topicId,
    level: input.level ?? 'A2',
    coverIcon: input.coverIcon ?? firstIcon ?? 'queue_music',
    coverId: input.coverId ?? null,
    visibility: input.visibility ?? 'private',
    shareCode: newShareCode(),
    inbox: input.inbox ?? false,
    items: [],
    createdAt: at,
    updatedAt: at,
    rev,
  };
  l.sets.set(set.id, set);
  insertItems(l, set, ownerId, input.items);
  return set;
}

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function assertOwnCover(l: Lib, userId: string, coverId: string): void {
  if (l.covers.get(coverId)?.ownerId !== userId) throw invalid('Unknown cover');
}

/** The learner's own copy of one of Loro's sets, listing its phrases rather than copying them. */
function copySet(api: FakeApi, l: Lib, userId: string, row: SetRec, nativeLang: LanguageCode | undefined): SetRec {
  const native = nativeLang && nativeLang !== row.targetLang ? nativeLang : 'en-GB';
  const locale = FIXTURE.languages.find((x) => x.code === native)?.uiLocale ?? 'en';
  return makeSet(api, l, userId, {
    title: row.title,
    description: row.subtitle?.[locale] ?? row.description,
    targetLang: row.targetLang,
    nativeLang: native,
    level: row.level,
    topicId: row.topicId,
    coverIcon: row.coverIcon,
    visibility: 'private',
    items: row.items.map((p) => ({ ref: p })),
  });
}

// ---------- songs, lyrics, covers ----------

const resolveOptions = (given: Partial<SongOptions> | undefined, base: SongOptions = DEFAULT_SONG_OPTIONS): SongOptions => ({ ...base, ...(given ?? {}) }) as SongOptions;
const lineLimit = (o: SongOptions) => SONG_LENGTH_LINES[o.length];

/** A set's phrases as a song sings them: as many as its length has lines for, room left for the chorus. */
function songPhrases(l: Lib, setId: string, nativeLang: string, o: SongOptions): { id: string; target: string; native: string }[] {
  const set = findSet(l, setId)!;
  const phrases = phrasesOfSet(l, set)
    .slice(0, lineLimit(o) - 4)
    .map((p) => ({ id: p.id as string, target: p.target as string, native: (p.translations[nativeLang] ?? Object.values(p.translations)[0] ?? '') as string }));
  if (phrases.length === 0) throw invalid('The set has no phrases');
  return phrases;
}

/** The set's phrases arranged as lyrics, nothing added: a verse, then a chorus that repeats the first. */
function assemble(phrases: { id: string; target: string; native: string }[], shift = 0): Section[] {
  const lines = phrases.map((p) => ({ text: p.target, meaning: p.native, phraseId: p.id }));
  const turned = shift > 0 ? [...lines.slice(shift % lines.length), ...lines.slice(0, shift % lines.length)] : lines;
  return [
    { name: 'verse', lines: turned },
    { name: 'chorus', lines: [turned[0], turned[0]] },
  ];
}

/** Lyrics as a song carries them: each line timed by the demo's bars. */
const timed = (sections: Section[], on: boolean): Wire[] => {
  let n = 0;
  return sections.map((s) => ({
    name: s.name,
    lines: s.lines.map((line) => {
      const start = n++ * LINE_MS;
      return { ...line, startMs: on ? start : null, endMs: on ? start + LINE_MS - 500 : null, written: null };
    }),
  }));
};

/** A song's sound is made: ready, sung from its lyrics. */
function finishSong(api: FakeApi, l: Lib, s: SongRec): void {
  s.status = 'ready';
  s.audio = true;
  s.error = null;
  // Timed by the demo's bars or by being heard back; with no timing the lines have no times.
  s.sections = timed(s.lyrics, s.sound.timing !== null);
  const album = l.albums.get(s.albumId);
  if (album) album.updatedAt = now();
  s.rev = bump(api);
}

function newSong(api: FakeApi, l: Lib, input: { ownerId: string; albumId: string; set: SetRec; title: string; styleId: string; options: SongOptions; lyrics: Section[]; lyricsBy: 'ai' | 'phrases'; approved: boolean }): SongRec {
  const song: SongRec = {
    id: `song-${newId().slice(-12)}`,
    albumId: input.albumId,
    ownerId: input.ownerId,
    setId: input.set.id,
    title: input.title,
    styleId: input.styleId,
    status: 'rendering',
    lyrics: input.lyrics,
    // What is known before it is sung: the learner's approved lines untimed, otherwise nothing.
    sections: input.approved ? timed(input.lyrics, false) : [],
    lyricsBy: input.lyricsBy,
    audio: false,
    sound: { by: 'demo', voiced: true, timing: 'demo' },
    options: input.options,
    error: null,
    createdAt: now(),
    polls: 0,
    rev: bump(api),
  };
  l.songs.set(song.id, song);
  return song;
}

function newAlbum(api: FakeApi, l: Lib, ownerId: string, input: { title: string; description?: string | null; targetLang: LanguageCode; coverId?: string | null; visibility?: Visibility }): AlbumRec {
  const at = now();
  const album: AlbumRec = {
    id: `album-u-${newId().slice(-12)}`,
    ownerId,
    targetLang: input.targetLang,
    title: input.title,
    description: blankToNull(input.description),
    coverId: input.coverId ?? null,
    visibility: input.visibility ?? 'private',
    shareCode: newShareCode(),
    createdAt: at,
    updatedAt: at,
    rev: bump(api),
  };
  l.albums.set(album.id, album);
  return album;
}

function lyricsWire(r: LyricsRec): Wire {
  return {
    id: r.id,
    setId: r.setId,
    styleId: r.styleId,
    title: r.title,
    status: r.status,
    sections: r.sections ?? [],
    lyricsBy: r.lyricsBy,
    revision: r.revision,
    instruction: r.instruction,
    options: r.options,
    updatedAt: r.updatedAt,
  };
}

/** The model's lyrics are in: a rewriting turns the lines round so a change shows. */
function finishLyrics(api: FakeApi, l: Lib, r: LyricsRec): void {
  const phrases = songPhrases(l, r.setId, r.nativeLang, r.options);
  r.sections = assemble(phrases, r.revision - 1);
  r.lyricsBy = 'ai';
  r.status = 'ready';
  r.updatedAt = now();
  bump(api);
}

function coverWire(c: CoverRec): Wire {
  return { id: c.id, status: c.status, url: c.status === 'ready' ? `/library/covers/${c.id}.svg` : null, provider: c.provider };
}

/** Puts a ready cover where it goes: a set or album only while the learner still owns it. */
function wear(api: FakeApi, l: Lib, userId: string, place: { kind: CoverKind; id: string }, coverId: string): void {
  const at = now();
  if (place.kind === 'set' || place.kind === 'album') {
    const row = place.kind === 'set' ? l.sets.get(place.id) : l.albums.get(place.id);
    if (row?.ownerId === userId) {
      row.coverId = coverId;
      row.updatedAt = at;
      row.rev = bump(api);
    }
    return;
  }
  l.itemCovers.set(keyOf(userId, place.kind, place.id), coverId);
  bump(api);
}

function finishCover(api: FakeApi, l: Lib, c: CoverRec): void {
  c.status = 'ready';
  if (c.place && c.ownerId) wear(api, l, c.ownerId, c.place, c.id);
  bump(api);
}

const wornCover = (l: Lib, userId: string, kind: CoverKind, itemId: string): string | null =>
  kind === 'set' || kind === 'album' ? ((kind === 'set' ? l.sets.get(itemId) : l.albums.get(itemId))?.coverId ?? null) : (l.itemCovers.get(keyOf(userId, kind, itemId)) ?? null);

// ---------- decks and notes ----------

const ICONS_FALLBACK = ['edit_note'];

/** Suggestions for a request from the fixture's phrase bank, as the server's bank answers: none when no theme fits. */
function bankDeck(api: FakeApi, user: User, req: Wire, provider: 'ai' | 'bank'): Wire {
  const words = String(req.input).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const themes = FIXTURE.bank.themes.filter((t) => t.keywords.some((k) => words.includes(k)) || words.includes(t.id));
  const avoid = new Set((req.avoid as string[]).map((a) => a.toLowerCase()));
  const phrases = FIXTURE.bank.phrases
    .filter((p) => p.targetLang === req.targetLang && themes.some((t) => t.id === p.theme) && p.translations[req.nativeLang as LanguageCode] && !avoid.has(p.target.toLowerCase()))
    .slice(0, Math.min(req.count, 12))
    .map((p) => ({
      target: p.target,
      native: p.translations[req.nativeLang as LanguageCode]!,
      image: p.image ?? ICONS_FALLBACK,
      notes: p.notes,
      source: provider === 'bank' ? 'bank' : 'ai',
      ...(provider === 'bank' ? { bankId: p.id } : {}),
      audio: clipsFor({ id: p.id, translations: { [req.nativeLang]: p.translations[req.nativeLang as LanguageCode] } }, req.targetLang),
    }));
  void api;
  void user;
  return { provider, phrases, themes: phrases.length > 0 ? [] : FIXTURE.bank.themes.map((t) => ({ id: t.id, title: t.title })) };
}

const GENERATE_PHRASES = {
  mode: oneOf(['topic', 'keywords', 'text']),
  input: text(2000, 2, true),
  targetLang: course,
  nativeLang: language,
  count: int(1, 12),
  avoid: list(100, text(120, 0, true)),
};
const INPUT_LIMITS: Record<string, number> = { topic: 80, keywords: 200, text: 2000 };

// ---------- routes ----------

type Authed = (req: Request & { user: User }, api: FakeApi, l: Lib) => Reply;

/** A route for a signed-in learner; a refusal thrown inside answers as the API does. */
function signedIn(handler: Authed): Route['handler'] {
  return (req, api) => {
    if (!req.user) return problem(401, 'UNAUTHENTICATED', 'Sign in first');
    return run(req, api, () => handler(req as Request & { user: User }, api, lib(api)));
  };
}

/** A route anyone may read, with more for the signed-in reader. */
function open(handler: (req: Request, api: FakeApi, l: Lib) => Reply): Route['handler'] {
  return (req, api) => run(req, api, () => handler(req, api, lib(api)));
}

function run(req: Request, api: FakeApi, handler: () => Reply): Reply {
  try {
    const reply = handler();
    // A change moves the pack's version.
    if (req.method !== 'GET' && reply.status < 300) bump(api);
    return reply;
  } catch (error) {
    if (error instanceof Refusal) return error.reply;
    throw error;
  }
}

const route = (method: string, pattern: string, handler: Route['handler']): Route => ({ method, pattern, handler });

export const libraryRoutes: Route[] = [
  // ---- reading ----
  route(
    'GET',
    '/library/community',
    open((req, api, l) => {
      const target = parse({ target: req.query.target }, { target: course }, ['target']).target as LanguageCode;
      const kind = (req.query.kind ?? 'sets') as string;
      const sort = (req.query.sort ?? 'new') as string;
      if (!['sets', 'albums'].includes(kind) || !['new', 'popular'].includes(sort)) throw invalid('Unknown kind or sort');
      const q = (req.query.q ?? '').trim().slice(0, 60).toLowerCase();
      const matchesQ = (row: { title: string; description: string | null }) => q === '' || row.title.toLowerCase().includes(q) || (row.description ?? '').toLowerCase().includes(q);
      const order = <T extends { id: string; ownerId: string | null; rev: number }>(rows: T[], itemKind: 'set' | 'album') =>
        rows.sort((a, b) => (sort === 'popular' ? savedBy(l, itemKind, b) - savedBy(l, itemKind, a) : 0) || b.rev - a.rev).slice(0, COMMUNITY_PAGE);
      if (kind === 'sets') {
        const rows = order(
          [...l.sets.values()].filter((s) => s.targetLang === target && s.visibility === 'public' && !hiddenFromCommunity(l, 'set', s.id) && matchesQ(s)),
          'set',
        );
        return json({ sets: rows.map((s) => ({ ...setWire(api, l, s, req.user?.id ?? null), savedBy: savedBy(l, 'set', s) })), phrases: phrasesOfSets(l, rows) });
      }
      const rows = order(
        [...l.albums.values()].filter(
          (a) => a.targetLang === target && a.visibility === 'public' && !hiddenFromCommunity(l, 'album', a.id) && matchesQ(a) && [...l.songs.values()].some((s) => s.albumId === a.id && s.status === 'ready'),
        ),
        'album',
      );
      return json({ albums: rows.map((a) => ({ ...albumWire(api, l, a, req.user?.id ?? null), savedBy: savedBy(l, 'album', a) })) });
    }),
  ),
  route(
    'GET',
    '/library/sets/:id',
    open((req, api, l) => json(setDetail(api, l, readableSet(l, req.user?.id ?? null, req.params.id), req.user?.id ?? null))),
  ),
  // A set's songs and the albums they are in: Loro's first, then the newest; what the reader may hear.
  route(
    'GET',
    '/library/sets/:id/songs',
    open((req, api, l) => {
      const userId = req.user?.id ?? null;
      const set = readableSet(l, userId, req.params.id);
      const songs = [...l.songs.values()]
        .filter((s) => {
          const album = l.albums.get(s.albumId);
          return s.setId === set.id && s.status === 'ready' && album !== undefined && (album.ownerId === userId || (album.visibility !== 'private' && !hiddenFromCommunity(l, 'album', album.id)));
        })
        .sort((a, b) => b.rev - a.rev)
        .slice(0, 20);
      const albums = [...new Set(songs.map((s) => s.albumId))].map((albumId) => albumWire(api, l, l.albums.get(albumId)!, userId));
      return json({ songs: songs.map((s) => songWire(s)), albums });
    }),
  ),
  // The maker's other public sets in the course: what Community would list of theirs.
  route(
    'GET',
    '/library/sets/:id/more',
    open((req, api, l) => {
      const userId = req.user?.id ?? null;
      const set = readableSet(l, userId, req.params.id);
      if (set.ownerId === null) return json({ sets: [], phrases: [] });
      const rows = [...l.sets.values()]
        .filter((s) => s.ownerId === set.ownerId && s.targetLang === set.targetLang && s.id !== set.id && s.visibility === 'public' && !hiddenFromCommunity(l, 'set', s.id))
        .sort((a, b) => b.rev - a.rev)
        .slice(0, MORE_BY_MAKER);
      return json({ sets: rows.map((s) => setWire(api, l, s, userId)), phrases: phrasesOfSets(l, rows) });
    }),
  ),
  route(
    'GET',
    '/library/albums/:id/more',
    open((req, api, l) => {
      const userId = req.user?.id ?? null;
      const album = readableAlbum(l, userId, req.params.id);
      const rows = [...l.albums.values()]
        .filter(
          (a) =>
            a.ownerId === album.ownerId &&
            a.targetLang === album.targetLang &&
            a.id !== album.id &&
            a.visibility === 'public' &&
            !hiddenFromCommunity(l, 'album', a.id) &&
            [...l.songs.values()].some((s) => s.albumId === a.id && s.status === 'ready'),
        )
        .sort((a, b) => b.rev - a.rev)
        .slice(0, MORE_BY_MAKER);
      return json({ albums: rows.map((a) => albumWire(api, l, a, userId)) });
    }),
  ),
  route(
    'GET',
    '/library/albums/:id',
    open((req, api, l) => json(albumDetail(api, l, readableAlbum(l, req.user?.id ?? null, req.params.id), req.user?.id ?? null))),
  ),
  // What a share code opens: a set with its phrases, or an album with its songs.
  route(
    'GET',
    '/library/shared/:code',
    open((req, api, l) => {
      if (!/^[a-z0-9]{10}$/.test(req.params.code)) throw invalid('Not a share code');
      const userId = req.user?.id ?? null;
      const set = [...l.sets.values(), ...loro().sets.values()].find((s) => s.shareCode === req.params.code);
      if (set) return json({ kind: 'set', ...setDetail(api, l, readableSet(l, userId, set.id), userId) });
      const album = [...l.albums.values()].find((a) => a.shareCode === req.params.code);
      if (album) return json({ kind: 'album', ...albumDetail(api, l, readableAlbum(l, userId, album.id), userId) });
      throw notFound();
    }),
  ),
  route(
    'GET',
    '/library/songs/:id',
    open((req, api, l) => {
      const song = l.songs.get(req.params.id);
      if (!song) throw notFound();
      readableAlbum(l, req.user?.id ?? null, song.albumId);
      // Asked after while it is made: ready once the app has asked enough.
      if (song.status === 'rendering' && ++song.polls > l.config.songPolls) finishSong(api, l, song);
      return json(songWire(song));
    }),
  ),
  // The sound itself: the app streams it through the (faked) player, so this is a stand-in.
  route(
    'GET',
    '/library/songs/:id/audio',
    open((req, _api, l) => {
      const song = l.songs.get(req.params.id);
      if (!song?.audio) throw notFound();
      return { status: 200, text: 'ID3', contentType: 'audio/mpeg' };
    }),
  ),
  // A cover: where it stands (`.json`, asked again until ready), or its drawing.
  route(
    'GET',
    '/library/covers/:file',
    open((req, api, l) => {
      const file = req.params.file;
      const cover = l.covers.get(file.replace(/\.(json|svg)$/, ''));
      if (!cover) throw notFound();
      if (file.endsWith('.json')) {
        if (cover.status === 'rendering' && ++cover.polls > l.config.coverPolls) finishCover(api, l, cover);
        return json(coverWire(cover));
      }
      if (cover.status !== 'ready') throw notFound();
      return { status: 200, text: '<svg xmlns="http://www.w3.org/2000/svg"/>', contentType: 'image/svg+xml' };
    }),
  ),

  // ---- the signed-in learner ----
  route(
    'GET',
    '/library/usage',
    signedIn((req, api, l) => {
      const at = now();
      const kinds = ['phrases', 'cover', 'song', 'lyrics'] as const;
      const ai = l.config.ai;
      return json({
        day: utcDay(at),
        resetsAt: resetsAt(),
        daily: Object.fromEntries(kinds.map((kind) => [kind, { used: api.used(req.user.id, kind), limit: api.limits[kind] }])),
        kept: Object.fromEntries((['sets', 'albums', 'songs'] as const).map((kind) => [kind, { used: keptCount(l, req.user.id, kind), limit: api.kept[kind] }])),
        writers: { phrases: ai ? 'ai' : 'bank', cover: ai ? 'ai' : 'pattern', lyrics: ai ? 'ai' : 'phrases', music: 'demo' },
      });
    }),
  ),
  route(
    'POST',
    '/library/push-tokens',
    signedIn((req, _api, l) => {
      parse(req.body, { token: matches(/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$/), lang: oneOf(['en', 'bg', 'ru', 'pl', 'cs']), platform: oneOf(['ios', 'android']) }, ['token', 'lang']);
      l.pushTokens.set(req.body.token, { userId: req.user.id, lang: req.body.lang, platform: req.body.platform });
      return json({ registered: true });
    }),
  ),
  route(
    'DELETE',
    '/library/push-tokens/:token',
    signedIn((req, _api, l) => {
      if (l.pushTokens.get(req.params.token)?.userId === req.user.id) l.pushTokens.delete(req.params.token);
      return noContent();
    }),
  ),
  // Everything the learner keeps in the library; their sign-in stays, and the day's allowance use.
  route(
    'POST',
    '/library/me/delete',
    signedIn((req, api, l) => {
      deleteLibraryOf(api, l, req.user);
      return json({ deleted: true });
    }),
  ),
  // The account itself, with everything in it: its sessions end with it.
  route(
    'POST',
    '/library/me/delete-account',
    signedIn((req, api, l) => {
      deleteLibraryOf(api, l, req.user);
      for (const [token, held] of [...l.pushTokens]) if (held.userId === req.user.id) l.pushTokens.delete(token);
      api.usage.delete(req.user.id);
      api.users.delete(req.user.id);
      for (const [token, userId] of [...api.access]) if (userId === req.user.id) api.access.delete(token);
      for (const [token, userId] of [...api.refresh]) if (userId === req.user.id) api.refresh.delete(token);
      return json({ deleted: true });
    }),
  ),

  // ---- sets and phrases ----
  route(
    'POST',
    '/library/sets',
    signedIn((req, api, l) => {
      const body = parse(
        req.body,
        {
          id: matches(/^mine-s-[a-z0-9][a-z0-9.-]{2,80}$/),
          title: text(60, 1),
          description: text(120),
          targetLang: course,
          nativeLang: language,
          level: oneOf(LEVELS),
          topicId: matches(/^[a-z-]{2,40}$/),
          coverIcon: matches(/^[a-z0-9_]{1,40}$/),
          coverId: id,
          visibility: oneOf(VISIBILITIES),
          phrases: list(MAX_SET_PHRASES, setItem),
        },
        ['title', 'targetLang', 'nativeLang', 'phrases'],
      );
      apart(body.targetLang, body.nativeLang);
      // A set uploaded from a device again (a sign-in cut short) is the one already uploaded.
      const held = body.id ? l.sets.get(body.id) : undefined;
      if (held?.ownerId === req.user.id) return { ...json(setDetail(api, l, held, req.user.id)), status: 201 };
      assertKept(api, l, req.user.id, 'sets');
      if (body.coverId) assertOwnCover(l, req.user.id, body.coverId);
      const set = makeSet(api, l, req.user.id, { ...body, title: body.title.trim(), description: body.description?.trim(), items: body.phrases });
      return json(setDetail(api, l, set, req.user.id), 201);
    }),
  ),
  route(
    'POST',
    '/library/sets/:id',
    signedIn((req, api, l) => {
      const set = ownSet(l, req.user.id, req.params.id);
      const body = parse(req.body, {
        title: text(60, 1),
        description: nullable(text(120)),
        level: oneOf(LEVELS),
        visibility: oneOf(VISIBILITIES),
        coverId: nullable(id),
        addPhrases: list(MAX_SET_PHRASES, setItem),
        removePhraseIds: list(MAX_SET_PHRASES, id),
        order: list(MAX_SET_PHRASES, id),
      });
      if (body.coverId) assertOwnCover(l, req.user.id, body.coverId);
      if (body.removePhraseIds?.length) removeItems(l, set, body.removePhraseIds);
      if (body.addPhrases?.length) {
        insertItems(l, set, req.user.id, body.addPhrases);
        if (new Set(set.items).size > MAX_SET_PHRASES) throw invalid(`A set holds at most ${MAX_SET_PHRASES} phrases`);
      }
      if (body.order?.length) set.items = [...body.order.filter((p: string) => set.items.includes(p)), ...set.items.filter((p) => !body.order.includes(p))];
      if (body.title !== undefined) set.title = body.title.trim();
      if (body.description !== undefined) set.description = blankToNull(body.description);
      if (body.level !== undefined) set.level = body.level;
      if (body.visibility !== undefined) set.visibility = body.visibility;
      if (body.coverId !== undefined) set.coverId = body.coverId;
      set.updatedAt = now();
      set.rev = bump(api);
      return json(setDetail(api, l, set, req.user.id));
    }),
  ),
  // New words for a phrase the learner holds in a set; notes and picture written again unless sent.
  route(
    'POST',
    '/library/sets/:id/phrases/:phraseId',
    signedIn((req, api, l) => {
      const set = ownSet(l, req.user.id, req.params.id);
      if (id(req.params.phraseId)) throw invalid('Not a phrase id');
      const body = parse(req.body, { target: text(120, 1, true), native: text(120, 1, true), image: iconList, notes: notesCheck, notesBy: oneOf(['ai', 'rules']) }, ['target', 'native']);
      const phrase = l.phrases.get(req.params.phraseId);
      if (phrase?.setId !== set.id) throw notFound();
      const given = body.notes && body.image ? { notes: body.notes, image: body.image, notesBy: body.notesBy } : { ...ruleNotes(body.target, body.native), notesBy: 'rules' as const };
      if (body.target !== phrase.target) phrase.source = 'written';
      phrase.target = body.target.trim();
      phrase.translations = { ...phrase.translations, [set.nativeLang]: body.native.trim() };
      phrase.image = given.image;
      phrase.notes = given.notes;
      phrase.noteTranslations = {};
      if (given.notesBy) phrase.notesBy = given.notesBy;
      else delete phrase.notesBy;
      set.updatedAt = now();
      set.rev = bump(api);
      return json(setDetail(api, l, set, req.user.id));
    }),
  ),
  // A phrase added on its own: into a set, or the learner's "My phrases" set, made the first time.
  route(
    'POST',
    '/library/phrases',
    signedIn((req, api, l) => {
      const body = parse(req.body, { phrase: shape(NEW_PHRASE, ['target', 'native', 'source']), targetLang: course, nativeLang: language, setId: id, inboxTitle: text(60, 1) }, ['phrase', 'targetLang', 'nativeLang', 'inboxTitle']);
      apart(body.targetLang, body.nativeLang);
      let target = body.setId ? undefined : [...l.sets.values()].find((s) => s.ownerId === req.user.id && s.targetLang === body.targetLang && s.inbox);
      if (!body.setId && !target) {
        // It is one of the learner's kept sets: at the cap, a phrase goes into a set they have.
        assertKept(api, l, req.user.id, 'sets');
        target = makeSet(api, l, req.user.id, { title: body.inboxTitle.trim(), targetLang: body.targetLang, nativeLang: body.nativeLang, coverIcon: 'edit_note', inbox: true, items: [] });
      }
      const set = target ?? ownSet(l, req.user.id, body.setId);
      if (set.targetLang !== body.targetLang) throw invalid('That set is in another course');
      insertItems(l, set, req.user.id, [body.phrase]);
      if (new Set(set.items).size > MAX_SET_PHRASES) throw invalid(`A set holds at most ${MAX_SET_PHRASES} phrases`);
      set.updatedAt = now();
      set.rev = bump(api);
      return json(setDetail(api, l, set, req.user.id), 201);
    }),
  ),
  // A phrase the learner holds, and every listing of it in their sets.
  route(
    'DELETE',
    '/library/phrases/:id',
    signedIn((req, api, l) => {
      const phrase = l.phrases.get(req.params.id);
      const holder = phrase ? l.sets.get(phrase.setId) : undefined;
      if (!phrase || holder?.ownerId !== req.user.id) throw notFound();
      for (const set of l.sets.values()) set.items = set.items.filter((p) => p !== phrase.id);
      l.phrases.delete(phrase.id);
      holder.updatedAt = now();
      holder.rev = bump(api);
      return noContent();
    }),
  ),
  route(
    'DELETE',
    '/library/sets/:id',
    signedIn((req, _api, l) => {
      const set = ownSet(l, req.user.id, req.params.id);
      removeItems(l, set, [...set.items]);
      for (const key of [...l.saves]) if (key.endsWith(`|set|${set.id}`)) l.saves.delete(key);
      l.sets.delete(set.id);
      return noContent();
    }),
  ),

  // ---- albums ----
  route(
    'POST',
    '/library/albums',
    signedIn((req, api, l) => {
      const body = parse(req.body, { title: text(60, 1), description: text(120), targetLang: course, coverId: id, visibility: oneOf(VISIBILITIES) }, ['title', 'targetLang']);
      if (body.coverId) assertOwnCover(l, req.user.id, body.coverId);
      assertKept(api, l, req.user.id, 'albums');
      const album = newAlbum(api, l, req.user.id, { ...body, title: body.title.trim(), description: body.description?.trim() });
      return json(albumDetail(api, l, album, req.user.id), 201);
    }),
  ),
  route(
    'POST',
    '/library/albums/:id',
    signedIn((req, api, l) => {
      const album = ownAlbum(l, req.user.id, req.params.id);
      const body = parse(req.body, { title: text(60, 1), description: nullable(text(120)), visibility: oneOf(VISIBILITIES), coverId: nullable(id), removeSongIds: list(100, id) });
      if (body.coverId) assertOwnCover(l, req.user.id, body.coverId);
      for (const songId of body.removeSongIds ?? []) if (l.songs.get(songId)?.albumId === album.id) l.songs.delete(songId);
      if (body.title !== undefined) album.title = body.title.trim();
      if (body.description !== undefined) album.description = blankToNull(body.description);
      if (body.visibility !== undefined) album.visibility = body.visibility;
      if (body.coverId !== undefined) album.coverId = body.coverId;
      album.updatedAt = now();
      album.rev = bump(api);
      return json(albumDetail(api, l, album, req.user.id));
    }),
  ),
  route(
    'DELETE',
    '/library/albums/:id',
    signedIn((req, _api, l) => {
      const album = ownAlbum(l, req.user.id, req.params.id);
      for (const song of [...l.songs.values()]) if (song.albumId === album.id) l.songs.delete(song.id);
      for (const key of [...l.saves]) if (key.endsWith(`|album|${album.id}`)) l.saves.delete(key);
      l.albums.delete(album.id);
      return noContent();
    }),
  ),

  // ---- saves and reports ----
  route(
    'POST',
    '/library/saves',
    signedIn((req, _api, l) => {
      const body = parse(req.body, { kind: oneOf(['set', 'album']), id }, ['kind', 'id']);
      if (body.kind === 'set') readableSet(l, req.user.id, body.id);
      else readableAlbum(l, req.user.id, body.id);
      l.saves.add(keyOf(req.user.id, body.kind, body.id));
      return json({ saved: true });
    }),
  ),
  route(
    'DELETE',
    '/library/saves/:kind/:id',
    signedIn((req, _api, l) => {
      const body = parse({ kind: req.params.kind, id: req.params.id }, { kind: oneOf(['set', 'album']), id }, ['kind', 'id']);
      l.saves.delete(keyOf(req.user.id, body.kind, body.id));
      return noContent();
    }),
  ),
  // One report per learner per item, of something they can see and don't own.
  route(
    'POST',
    '/library/reports',
    signedIn((req, _api, l) => {
      const body = parse(req.body, { kind: oneOf(['set', 'album']), id, reason: oneOf(['offensive', 'wrong', 'spam', 'other']) }, ['kind', 'id', 'reason']);
      const row = body.kind === 'set' ? readableSet(l, req.user.id, body.id) : readableAlbum(l, req.user.id, body.id);
      if (row.ownerId === null || row.ownerId === req.user.id) throw invalid('Nothing to report');
      l.reports.set(keyOf(req.user.id, body.kind, body.id), body.reason);
      return json({ reported: true });
    }),
  ),

  // ---- writing for the learner: decks and notes ----
  route(
    'POST',
    '/library/decks',
    signedIn((req, api, l) => {
      const body = parse({ count: 12, avoid: [], ...req.body }, GENERATE_PHRASES, ['mode', 'input', 'targetLang', 'nativeLang']);
      if (String(body.input).trim().length > INPUT_LIMITS[body.mode]) throw invalid('Input too long');
      apart(body.targetLang, body.nativeLang);
      if (!l.config.ai) return { status: 202, body: { id: null, status: 'ready', ...bankDeck(api, req.user, body, 'bank') } };
      spend(api, req.user, 'phrases');
      const deck: DeckRec = { id: `deck-${newId().slice(-12)}`, ownerId: req.user.id, status: 'writing', result: bankDeck(api, req.user, body, 'ai'), polls: 0 };
      l.decks.set(deck.id, deck);
      return { status: 202, body: { id: deck.id, status: 'writing' } };
    }),
  ),
  route(
    'GET',
    '/library/decks/:id',
    signedIn((req, _api, l) => {
      const deck = l.decks.get(req.params.id);
      if (deck?.ownerId !== req.user.id) throw notFound();
      if (deck.status === 'writing' && ++deck.polls > l.config.deckPolls) deck.status = 'ready';
      return json(deck.status === 'ready' ? { id: deck.id, status: 'ready', ...deck.result } : { id: deck.id, status: deck.status });
    }),
  ),
  // A deck written while the request waits, for app builds from before `decks`.
  route(
    'POST',
    '/library/generate/phrases',
    signedIn((req, api, l) => {
      const body = parse({ count: 12, avoid: [], ...req.body }, GENERATE_PHRASES, ['mode', 'input', 'targetLang', 'nativeLang']);
      apart(body.targetLang, body.nativeLang);
      if (!l.config.ai) return json(bankDeck(api, req.user, body, 'bank'));
      spend(api, req.user, 'phrases');
      return json(bankDeck(api, req.user, body, 'ai'));
    }),
  ),
  // Notes for a phrase the learner wrote: the model's from the allowance, otherwise Loro's rules, free.
  route(
    'POST',
    '/library/generate/notes',
    signedIn((req, api, l) => {
      const body = parse(req.body, { target: text(120, 1, true), native: text(120, 1, true), targetLang: course, nativeLang: language }, ['target', 'native', 'targetLang', 'nativeLang']);
      apart(body.targetLang, body.nativeLang);
      if (l.config.ai) spend(api, req.user, 'phrases');
      return json({ provider: l.config.ai ? 'ai' : 'rules', ...ruleNotes(body.target.trim(), body.native.trim()) });
    }),
  ),
  // Another mnemonic or grammar note, from the allowance: Loro's rules have only one, so none without a model.
  route(
    'POST',
    '/library/generate/note',
    signedIn((req, api, l) => {
      const body = parse(
        req.body,
        { kind: oneOf(['mnemonic', 'grammar']), target: text(120, 1, true), native: text(120, 1, true), targetLang: course, nativeLang: language, previous: list(10, shape(noteShape, ['title', 'text']), 1) },
        ['kind', 'target', 'native', 'targetLang', 'nativeLang', 'previous'],
      );
      apart(body.targetLang, body.nativeLang);
      if (!l.config.ai) throw unavailable('No writer for another note');
      spend(api, req.user, 'phrases');
      const n = body.previous.length + 1;
      return json({ kind: body.kind, note: { title: `Another ${body.kind} (${n})`, text: `Version ${n} for “${body.target.trim()}”: ${body.native.trim()}.` } });
    }),
  ),

  // ---- covers ----
  route(
    'POST',
    '/library/generate/cover',
    signedIn((req, api, l) => {
      const body = parse(
        req.body,
        { kind: oneOf(COVER_KINDS), title: text(60, 1), description: text(200), prompt: text(200, 1), attachTo: id, nativeLang: language },
        ['kind'],
      );
      if (body.attachTo === undefined && body.title === undefined) throw invalid('A cover needs a title or an item to go on');
      if (body.attachTo === undefined && body.kind !== 'set' && body.kind !== 'album') throw invalid('A phrase’s or song’s cover goes on it');
      // What it goes on is settled before the allowance is spent.
      let target: { kind: CoverKind; id: string; copyOf?: SetRec } | null = null;
      if (body.attachTo) {
        const itemId = body.attachTo as string;
        if (body.kind === 'set') {
          const row = readableSet(l, req.user.id, itemId);
          if (row.ownerId !== null && row.ownerId !== req.user.id) throw notFound();
          if (row.ownerId === null) assertKept(api, l, req.user.id, 'sets');
          target = { kind: 'set', id: itemId, ...(row.ownerId === null ? { copyOf: row } : {}) };
        } else if (body.kind === 'album') {
          const row = readableAlbum(l, req.user.id, itemId);
          if (row.ownerId !== req.user.id) throw notFound();
          target = { kind: 'album', id: itemId };
        } else if (body.kind === 'song') {
          const song = l.songs.get(itemId);
          if (!song) throw notFound();
          readableAlbum(l, req.user.id, song.albumId);
          target = { kind: 'song', id: itemId };
        } else {
          const holder = holderOf(l, itemId);
          if (!holder) throw notFound();
          readableSet(l, req.user.id, holder.id);
          target = { kind: 'phrase', id: itemId };
        }
      }
      spend(api, req.user, 'cover');
      const place = target?.copyOf ? { kind: 'set' as const, id: copySet(api, l, req.user.id, target.copyOf, body.nativeLang).id } : target ? { kind: target.kind, id: target.id } : null;
      const drawNow = !l.config.ai;
      const cover: CoverRec = {
        id: `cover-${newId().slice(-12)}`,
        ownerId: req.user.id,
        provider: drawNow ? 'pattern' : 'ai',
        status: 'rendering',
        itemKind: place?.kind ?? null,
        itemId: place?.id ?? null,
        prompt: body.prompt ?? null,
        createdAt: now(),
        seq: ++l.seq,
        polls: 0,
        place,
      };
      l.covers.set(cover.id, cover);
      if (drawNow) finishCover(api, l, cover);
      return json({ ...coverWire(cover), ...(target?.copyOf && place ? { copy: place } : {}) }, 201);
    }),
  ),
  // The covers the learner drew for an item, newest first, and which of them it wears.
  route(
    'GET',
    '/library/covers/:kind/:id',
    signedIn((req, _api, l) => {
      const body = parse({ kind: req.params.kind, id: req.params.id }, { kind: oneOf(COVER_KINDS), id }, ['kind', 'id']);
      const covers = [...l.covers.values()]
        .filter((c) => c.ownerId === req.user.id && c.itemKind === body.kind && c.itemId === body.id && c.status === 'ready')
        .sort((a, b) => b.seq - a.seq)
        .slice(0, COVER_HISTORY_LIMIT);
      return json({
        covers: covers.map((c) => ({ id: c.id, url: `/library/covers/${c.id}.svg`, provider: c.provider, prompt: c.prompt, createdAt: c.createdAt })),
        current: wornCover(l, req.user.id, body.kind, body.id),
      });
    }),
  ),
  // An earlier cover put back on the item it was drawn for: nothing drawn, nothing spent.
  route(
    'POST',
    '/library/covers/:id/wear',
    signedIn((req, api, l) => {
      const coverId = req.params.id;
      if (id(coverId)) throw invalid('Not a cover id');
      const body = parse(req.body, { kind: oneOf(COVER_KINDS), attachTo: id }, ['kind', 'attachTo']);
      const cover = l.covers.get(coverId);
      if (cover?.ownerId !== req.user.id || cover.status !== 'ready' || cover.itemKind !== body.kind || cover.itemId !== body.attachTo) throw notFound();
      // Still theirs to change: an item they lost, or one no longer theirs, is not found.
      if (body.kind === 'set' && l.sets.get(body.attachTo)?.ownerId !== req.user.id) throw notFound();
      if (body.kind === 'album' && l.albums.get(body.attachTo)?.ownerId !== req.user.id) throw notFound();
      if (body.kind === 'song' && !l.songs.has(body.attachTo)) throw notFound();
      if (body.kind === 'phrase' && !holderOf(l, body.attachTo)) throw notFound();
      wear(api, l, req.user.id, { kind: body.kind, id: body.attachTo }, cover.id);
      return json(coverWire(cover));
    }),
  ),

  // ---- lyrics and songs ----
  route(
    'POST',
    '/library/lyrics',
    signedIn((req, api, l) => {
      const body = parse(req.body, { setId: id, styleId: oneOf(SONG_STYLES), nativeLang: language, title: text(60, 1), options }, ['setId', 'styleId', 'nativeLang']);
      const o = resolveOptions(body.options);
      const set = readableSet(l, req.user.id, body.setId);
      const phrases = songPhrases(l, set.id, body.nativeLang, o);
      if (l.config.ai) spend(api, req.user, 'lyrics');
      const draft: LyricsRec = {
        id: `lyrics-${newId().slice(-12)}`,
        ownerId: req.user.id,
        setId: set.id,
        styleId: body.styleId,
        title: body.title?.trim() ?? set.title,
        status: l.config.ai ? 'writing' : 'ready',
        sections: l.config.ai ? null : assemble(phrases),
        lyricsBy: l.config.ai ? null : 'phrases',
        revision: 1,
        instruction: null,
        options: o,
        nativeLang: body.nativeLang,
        updatedAt: now(),
        polls: 0,
      };
      l.lyrics.set(draft.id, draft);
      return { status: 202, body: lyricsWire(draft) };
    }),
  ),
  route(
    'GET',
    '/library/lyrics/:id',
    signedIn((req, api, l) => {
      const draft = ownDraft(l, req.user.id, req.params.id);
      if (draft.status === 'writing' && ++draft.polls > l.config.lyricsPolls) finishLyrics(api, l, draft);
      return json(lyricsWire(draft));
    }),
  ),
  // The draft written again: anew, or changed as the learner asks. Needs a text model.
  route(
    'POST',
    '/library/lyrics/:id/rewrite',
    signedIn((req, api, l) => {
      const body = parse(req.body, { instruction: text(200, 1) });
      const draft = ownDraft(l, req.user.id, req.params.id);
      if (!l.config.ai) throw unavailable('No text model writes lyrics here');
      if (draft.status === 'writing') throw invalid('The lyrics are still being written');
      spend(api, req.user, 'lyrics');
      draft.status = 'writing';
      draft.instruction = body.instruction?.trim() ?? null;
      draft.revision += 1;
      draft.polls = 0;
      draft.updatedAt = now();
      return { status: 202, body: lyricsWire(draft) };
    }),
  ),
  // A song, from the learner's approved lyrics or with its lyrics written here: `rendering` until made.
  route(
    'POST',
    '/library/generate/song',
    signedIn((req, api, l) => {
      const body = parse(
        req.body,
        { setId: id, styleId: oneOf(SONG_STYLES), nativeLang: language, title: text(60, 1), albumId: id, lyricsId: id, options },
        ['setId', 'styleId', 'nativeLang'],
      );
      const set = readableSet(l, req.user.id, body.setId);
      let approved: LyricsRec | null = null;
      let o = resolveOptions(body.options);
      if (body.lyricsId) {
        approved = ownDraft(l, req.user.id, body.lyricsId);
        if (approved.setId !== set.id) throw invalid('The lyrics are for another set');
        if (approved.status !== 'ready' || !approved.sections?.length) throw invalid('The lyrics are not ready');
        o = resolveOptions(body.options, approved.options);
      }
      const phrases = songPhrases(l, set.id, body.nativeLang, o);
      assertKept(api, l, req.user.id, 'songs');
      let album = body.albumId ? ownAlbum(l, req.user.id, body.albumId) : null;
      if (album && album.targetLang !== set.targetLang) throw invalid('The album is in another language');
      // A new album must fit before the allowance is spent on a song that couldn't be kept.
      if (!album) assertKept(api, l, req.user.id, 'albums');
      spend(api, req.user, 'song');
      album ??= newAlbum(api, l, req.user.id, { title: set.title, targetLang: set.targetLang, visibility: 'private', coverId: set.coverId });
      const song = newSong(api, l, {
        ownerId: req.user.id,
        albumId: album.id,
        set,
        title: body.title?.trim() ?? set.title,
        styleId: body.styleId,
        options: o,
        lyrics: approved?.sections ?? assemble(phrases),
        lyricsBy: approved ? (approved.lyricsBy ?? 'phrases') : l.config.ai ? 'ai' : 'phrases',
        approved: approved !== null,
      });
      album.updatedAt = now();
      return { status: 202, body: { song: songWire(song), album: albumWire(api, l, album, req.user.id) } };
    }),
  ),
  // A failed song, made again for another of the day's songs (given back if it fails again).
  route(
    'POST',
    '/library/songs/:id/retry',
    signedIn((req, api, l) => {
      const body = parse(req.body, { nativeLang: language }, ['nativeLang']);
      const song = ownSong(l, req.user.id, req.params.id);
      songPhrases(l, song.setId, body.nativeLang, song.options);
      if (song.status !== 'failed') throw invalid('Only a failed song can be made again');
      spend(api, req.user, 'song');
      song.status = 'rendering';
      song.error = null;
      song.polls = 0;
      song.createdAt = now();
      return { status: 202, body: songWire(song) };
    }),
  ),
  // Takes a song out of the learner's album.
  route(
    'DELETE',
    '/library/songs/:id',
    signedIn((req, _api, l) => {
      const song = ownSong(l, req.user.id, req.params.id);
      if (song.status === 'rendering') throw invalid('The song is still being made');
      l.songs.delete(song.id);
      const album = l.albums.get(song.albumId);
      if (album) album.updatedAt = now();
      return noContent();
    }),
  ),
];

/** Everything a learner keeps in the library; the day's allowance use stays. */
function deleteLibraryOf(api: FakeApi, l: Lib, user: User): void {
  const mine = <T extends { ownerId: string | null }>(rows: Map<string, T>) => [...rows.values()].filter((r) => r.ownerId === user.id);
  const sets = mine(l.sets);
  const albums = mine(l.albums);
  for (const set of sets) {
    for (const phraseId of set.items) for (const other of l.sets.values()) if (other.id !== set.id) other.items = other.items.filter((p) => p !== phraseId || l.phrases.get(p)?.setId !== set.id);
    for (const phrase of [...l.phrases.values()]) if (phrase.setId === set.id) l.phrases.delete(phrase.id);
    for (const key of [...l.saves]) if (key.endsWith(`|set|${set.id}`)) l.saves.delete(key);
    l.sets.delete(set.id);
  }
  for (const album of albums) {
    for (const key of [...l.saves]) if (key.endsWith(`|album|${album.id}`)) l.saves.delete(key);
    l.albums.delete(album.id);
  }
  for (const song of [...l.songs.values()]) if (song.ownerId === user.id || albums.some((a) => a.id === song.albumId)) l.songs.delete(song.id);
  for (const [key] of [...l.reports]) if (key.startsWith(`${user.id}|`) || sets.some((s) => key.endsWith(`|set|${s.id}`)) || albums.some((a) => key.endsWith(`|album|${a.id}`))) l.reports.delete(key);
  for (const key of [...l.saves]) if (key.startsWith(`${user.id}|`)) l.saves.delete(key);
  for (const key of [...l.itemCovers.keys()]) if (key.startsWith(`${user.id}|`)) l.itemCovers.delete(key);
  for (const cover of [...l.covers.values()]) if (cover.ownerId === user.id) l.covers.delete(cover.id);
  for (const draft of [...l.lyrics.values()]) if (draft.ownerId === user.id) l.lyrics.delete(draft.id);
  for (const deck of [...l.decks.values()]) if (deck.ownerId === user.id) l.decks.delete(deck.id);
  api.progress.delete(user.id);
  user.displayName = null;
}

/** Wires the library into a fresh fake API: the pack carries a signed-in learner's own and saved sets. */
export function installLibrary(api: FakeApi): void {
  const l = lib(api);
  api.store.packExtras = (targetLang: LanguageCode, user: User | null) => {
    if (!user) return { sets: [], phrases: [], albums: [] };
    const sets = [...l.sets.values()].filter((s) => s.targetLang === targetLang && (s.ownerId === user.id || (l.saves.has(keyOf(user.id, 'set', s.id)) && canRead(s, user.id))));
    const albums = [...l.albums.values()].filter((a) => a.targetLang === targetLang && (a.ownerId === user.id || (l.saves.has(keyOf(user.id, 'album', a.id)) && canRead(a, user.id))));
    const hidden = (kind: 'set' | 'album', wire: Wire) => (wire.owner === 'me' && wire.visibility === 'public' && hiddenFromCommunity(l, kind, wire.id) ? { ...wire, hidden: true } : wire);
    const covers = { phrases: {} as Record<string, string>, songs: {} as Record<string, string> };
    for (const [key, coverId] of l.itemCovers) {
      const [owner, kind, itemId] = key.split('|');
      if (owner !== user.id) continue;
      const setOf = kind === 'phrase' ? holderOf(l, itemId) : undefined;
      const albumOf = kind === 'song' ? l.albums.get(l.songs.get(itemId)?.albumId ?? '') : undefined;
      if (setOf?.targetLang === targetLang) covers.phrases[itemId] = coverPath(coverId)!;
      if (albumOf?.targetLang === targetLang) covers.songs[itemId] = coverPath(coverId)!;
    }
    return {
      sets: sets.map((s) => hidden('set', setWire(api, l, s, user.id))),
      phrases: phrasesOfSets(l, sets).filter((p) => !loro().phrases.has(p.id)),
      albums: albums.map((a) => hidden('album', albumWire(api, l, a, user.id))),
      covers,
    };
  };
}

// ---------- seeding: for tests to set the server's world up, before or after launch ----------

interface SeedPhrase {
  target: string;
  native: string;
}

/** The learner's set `title` with these phrases; returns its id, share code and phrase ids. */
export function seedSet(
  api: FakeApi,
  owner: User,
  input: { title: string; phrases: SeedPhrase[]; visibility?: Visibility; targetLang?: LanguageCode; nativeLang?: LanguageCode; description?: string; level?: Level; coverId?: string },
): { id: string; shareCode: string; phraseIds: string[] } {
  const l = lib(api);
  const set = makeSet(api, l, owner.id, {
    title: input.title,
    description: input.description,
    targetLang: input.targetLang ?? 'es-ES',
    nativeLang: input.nativeLang ?? 'en-GB',
    level: input.level,
    coverId: input.coverId,
    visibility: input.visibility,
    items: input.phrases.map((p) => ({ target: p.target, native: p.native, source: 'written' })),
  });
  return { id: set.id, shareCode: set.shareCode, phraseIds: [...set.items] };
}

/** A set by another learner, public by default, whose maker is called `displayName`. */
export function communitySet(
  api: FakeApi,
  input: { title: string; displayName: string; phrases: SeedPhrase[]; visibility?: Visibility; targetLang?: LanguageCode; nativeLang?: LanguageCode },
): { id: string; shareCode: string; phraseIds: string[]; maker: User } {
  const maker = makerOf(api, input.displayName);
  return { ...seedSet(api, maker, { ...input, visibility: input.visibility ?? 'public' }), maker };
}

/** Another learner called `displayName`, made once. */
function makerOf(api: FakeApi, displayName: string): User {
  const email = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@community.test`;
  const maker = api.addUser(email);
  maker.displayName = displayName;
  return maker;
}

/** A song in an album, ready by default, sung from the set's phrases; returns its id. */
export function seedSong(
  api: FakeApi,
  owner: User,
  input: {
    albumId: string;
    setId: string;
    title?: string;
    styleId?: string;
    status?: 'ready' | 'rendering' | 'failed';
    error?: string;
    /** Sung by ElevenLabs (heard back for its timings unless `timing` says otherwise), or the demo. */
    sound?: { by: 'elevenlabs' | 'demo'; voiced?: boolean; timing?: 'transcript' | 'demo' | null };
    /**
     * Lines (counted through the song from 0) the singer sang differently: their sung words, or null
     * for a line the heard-back song doesn't have (no times).
     */
    sungAs?: Record<number, string | null>;
  },
): { id: string } {
  const l = lib(api);
  const set = findSet(l, input.setId);
  if (!set) throw new Error(`No set ${input.setId}`);
  const o = resolveOptions(undefined);
  const song = newSong(api, l, {
    ownerId: owner.id,
    albumId: input.albumId,
    set,
    title: input.title ?? set.title,
    styleId: input.styleId ?? 'modern_pop',
    options: o,
    lyrics: assemble(songPhrases(l, set.id, 'en-GB', o)),
    lyricsBy: 'phrases',
    approved: false,
  });
  if (input.sound) {
    const sung = input.sound.by === 'elevenlabs';
    song.sound = { by: input.sound.by, voiced: input.sound.voiced ?? true, timing: input.sound.timing !== undefined ? input.sound.timing : sung ? 'transcript' : 'demo' };
  }
  if ((input.status ?? 'ready') === 'ready') {
    finishSong(api, l, song);
    // Heard back: a line sung differently shows as sung, with what was written beside it.
    let at = 0;
    for (const section of song.sections as { lines: { text: string; meaning: string; written?: unknown; startMs: number | null; endMs: number | null }[] }[])
      for (const line of section.lines) {
        const sungText = input.sungAs?.[at++];
        if (sungText === null) {
          line.startMs = null;
          line.endMs = null;
        } else if (sungText !== undefined) {
          line.written = { text: line.text, meaning: line.meaning };
          line.text = sungText;
        }
      }
  } else if (input.status === 'failed') {
    song.status = 'failed';
    song.error = input.error ?? 'The music service failed';
  }
  return { id: song.id };
}

/** An album of the learner's with songs (ready by default) sung from `setId`; returns its id and share code. */
export function seedAlbum(
  api: FakeApi,
  owner: User,
  input: { title?: string; visibility?: Visibility; targetLang?: LanguageCode; setId: string; songs?: { title?: string; status?: 'ready' | 'rendering' | 'failed' }[] },
): { id: string; shareCode: string; songIds: string[] } {
  const l = lib(api);
  const set = findSet(l, input.setId);
  if (!set) throw new Error(`No set ${input.setId}`);
  const album = newAlbum(api, l, owner.id, { title: input.title ?? set.title, targetLang: input.targetLang ?? set.targetLang, visibility: input.visibility });
  const songs = (input.songs ?? [{}]).map((s) => seedSong(api, owner, { albumId: album.id, setId: input.setId, title: s.title, status: s.status }).id);
  return { id: album.id, shareCode: album.shareCode, songIds: songs };
}

/** A public album by another learner called `displayName`, with ready songs sung from a set of theirs. */
export function communityAlbum(api: FakeApi, input: { title: string; displayName: string; setId: string; songs?: { title?: string }[]; targetLang?: LanguageCode }): { id: string; shareCode: string; songIds: string[]; maker: User } {
  const maker = makerOf(api, input.displayName);
  return { ...seedAlbum(api, maker, { title: input.title, visibility: 'public', setId: input.setId, songs: input.songs, targetLang: input.targetLang }), maker };
}

/** Finishes a song still being made: it is ready, with its sound. */
export function readySong(api: FakeApi, songId: string): void {
  const song = lib(api).songs.get(songId);
  if (!song) throw new Error(`No song ${songId}`);
  finishSong(api, lib(api), song);
}

/** Fails a song being made, as the music service failing does, and gives its allowance back. */
export function failSong(api: FakeApi, songId: string, error = 'The music service failed'): void {
  const l = lib(api);
  const song = l.songs.get(songId);
  if (!song) throw new Error(`No song ${songId}`);
  song.status = 'failed';
  song.error = error;
  api.refund(song.ownerId, 'song');
  song.rev = bump(api);
}

/** Finishes a cover being drawn: ready, and on its item. */
export function readyCover(api: FakeApi, coverId: string): void {
  const cover = lib(api).covers.get(coverId);
  if (!cover) throw new Error(`No cover ${coverId}`);
  finishCover(api, lib(api), cover);
}

/** Finishes lyrics being written. */
export function readyLyrics(api: FakeApi, lyricsId: string): void {
  const draft = lib(api).lyrics.get(lyricsId);
  if (!draft) throw new Error(`No lyrics ${lyricsId}`);
  finishLyrics(api, lib(api), draft);
}
