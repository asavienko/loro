// The library's routes (plan 106): what the app reads, makes and shares. Shapes mirror the API's
// apps/api/src/library/library.types.ts; the app reads them without zod, as it reads its content.
import type { Album, ContentPack, LanguageCode, LanguageList, PhraseSet, PhraseWire, Visibility } from '../content';
import type { OwnNotes } from '../state/types';
import { api, ApiError } from './client';

/** The styles a song can be sung in (plan 113), in the order the sheet offers them. */
export const SONG_STYLES = ['modern_pop', 'acoustic_folk', 'gentle_ballad', 'upbeat_kids', 'indie_rock', 'hip_hop', 'reggaeton', 'jazz_lounge', 'electronic_dance', 'country', 'lullaby', 'bossa_nova'] as const;
export type SongStyle = (typeof SONG_STYLES)[number];

export interface SongLine {
  /** The line as it is heard: as sung, where the song was heard back (plan 113); as written otherwise. */
  text: string;
  meaning: string;
  /** The set phrase this line sings, if it is one. */
  phraseId: string | null;
  /** When the line plays, where the sound's timing is known: heard in the sung song, or the demo's bars. */
  startMs: number | null;
  endMs: number | null;
  /** The line as written, with its meaning, when the singer sang it differently; null (or absent) when the same. */
  written?: { text: string; meaning: string } | null;
}

export interface Song {
  id: string;
  albumId: string;
  setId: string;
  title: string;
  styleId: SongStyle;
  status: 'rendering' | 'ready' | 'failed';
  sections: { name: 'verse' | 'chorus' | 'bridge'; lines: SongLine[] }[];
  /** `ai`, or `phrases`: the set's phrases arranged with nothing added. */
  lyricsBy: 'ai' | 'phrases';
  audioUrl: string | null;
  /** `elevenlabs` (sung), or `demo`: the server's instrumental, labelled "Demo sound". */
  audioBy: 'elevenlabs' | 'demo' | null;
  /** The lines are spoken over the sound: the server's voice over the demo, or sung. */
  voiced: boolean;
  /**
   * Where the lines' timings come from (plan 113): `transcript`, the sung song heard back, its
   * lines as sung; `demo`, the synthesizer's bars; null, none. An older server sends nothing.
   */
  timingBy?: 'transcript' | 'demo' | null;
  durationMs: number | null;
  error: string | null;
  createdAt: number;
}

/** A song's lyrics before the song (plan 113): read, changed and approved by the learner. */
export interface Lyrics {
  id: string;
  setId: string;
  styleId: SongStyle;
  title: string;
  status: 'writing' | 'ready' | 'failed';
  sections: { name: 'verse' | 'chorus' | 'bridge'; lines: { text: string; meaning: string; phraseId: string | null }[] }[];
  lyricsBy: 'ai' | 'phrases' | null;
  /** How many times they were written. */
  revision: number;
  /** What the learner last asked to change. */
  instruction: string | null;
  updatedAt: number;
}

export type UsageKind = 'phrases' | 'cover' | 'song' | 'lyrics';

export interface Usage {
  day: string;
  resetsAt: number;
  /** An older server sends no `lyrics`. */
  daily: Record<UsageKind, { used: number; limit: number }>;
  kept: Record<'sets' | 'albums' | 'songs', { used: number; limit: number }>;
  /** Who writes each kind on this server: a model, or the labelled fallback. */
  writers: { phrases: 'ai' | 'bank'; cover: 'ai' | 'pattern'; lyrics: 'ai' | 'phrases'; music: 'elevenlabs' | 'demo' };
}

export interface NewPhrase {
  /** A phrase uploaded from this device keeps the device's id, and with it its progress (plan 108). */
  id?: string;
  target: string;
  native: string;
  /** Without a picture and notes, the server writes both (plan 108). */
  image?: string[];
  notes?: OwnNotes;
  /** Who wrote the notes sent: a model, or the server's rules. */
  notesBy?: 'ai' | 'rules';
  source: 'ai' | 'bank' | 'course' | 'written';
  bankId?: string;
}

/** What a learner's set lists: a phrase already in the library (Loro's or theirs) by id, or a new one it holds. */
export type SetItem = { ref: string } | NewPhrase;

export interface SetDetail {
  set: PhraseSet;
  phrases: PhraseWire[];
}

export interface AlbumDetail {
  album: Album;
  songs: Song[];
}

export type Shared = ({ kind: 'set' } & SetDetail) | ({ kind: 'album' } & AlbumDetail);

export const fetchPack = (targetLang: LanguageCode) => api<ContentPack>(`/library/pack?target=${targetLang}`, { timeoutMs: 30_000 });

/** The languages the server teaches and speaks in (plan 108). */
export const fetchLanguages = () => api<LanguageList>('/library/languages');

/** Community's order: the newest first, or the most saved first. */
export type CommunitySort = 'new' | 'popular';

export const fetchCommunitySets = (targetLang: LanguageCode, q = '', sort: CommunitySort = 'new') =>
  api<{ sets: PhraseSet[]; phrases: PhraseWire[] }>(`/library/community?kind=sets&target=${targetLang}&q=${encodeURIComponent(q)}&sort=${sort}`);

export const fetchCommunityAlbums = (targetLang: LanguageCode, q = '', sort: CommunitySort = 'new') =>
  api<{ albums: Album[] }>(`/library/community?kind=albums&target=${targetLang}&q=${encodeURIComponent(q)}&sort=${sort}`);

/** A shared set's or album's maker's other public ones, in its course. */
export const fetchMoreSets = (setId: string) => api<{ sets: PhraseSet[]; phrases: PhraseWire[] }>(`/library/sets/${encodeURIComponent(setId)}/more`);
export const fetchMoreAlbums = (albumId: string) => api<{ albums: Album[] }>(`/library/albums/${encodeURIComponent(albumId)}/more`);

export const fetchSet = (id: string) => api<SetDetail>(`/library/sets/${encodeURIComponent(id)}`);
export const fetchAlbum = (id: string) => api<AlbumDetail>(`/library/albums/${encodeURIComponent(id)}`);
export const fetchShared = (code: string) => api<Shared>(`/library/shared/${encodeURIComponent(code)}`);
export const fetchSetSongs = (setId: string) => api<{ songs: Song[]; albums: Album[] }>(`/library/sets/${encodeURIComponent(setId)}/songs`);
/**
 * Plan 111: the server names its writer `ai`; one from before said `claude`. Read here, once, so the
 * rest of the app knows only `ai` whichever server it talks to. (A song's `lyricsBy` is read where
 * it is shown.)
 */
const ai = <T extends string>(value: T | 'claude'): T | 'ai' => (value === 'claude' ? 'ai' : value);

export const fetchSong = (id: string) => api<Song>(`/library/songs/${encodeURIComponent(id)}`);
export const fetchUsage = () =>
  api<Usage>('/library/usage', { auth: 'required' }).then((usage) => ({
    ...usage,
    writers: {
      ...usage.writers,
      phrases: ai(usage.writers.phrases) as Usage['writers']['phrases'],
      cover: ai(usage.writers.cover) as Usage['writers']['cover'],
      lyrics: ai(usage.writers.lyrics) as Usage['writers']['lyrics'],
    },
  }));

export const createSet = (body: {
  /** A set uploaded from this device keeps the device's id; uploading it again changes nothing. */
  id?: string;
  title: string;
  description?: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  level?: 'A1' | 'A2' | 'B1';
  topicId?: string;
  coverId?: string;
  visibility: Visibility;
  phrases: SetItem[];
}) => api<SetDetail>('/library/sets', { method: 'POST', body, auth: 'required' });

export const updateSet = (
  id: string,
  body: {
    title?: string;
    description?: string | null;
    visibility?: Visibility;
    coverId?: string | null;
    addPhrases?: SetItem[];
    removePhraseIds?: string[];
    /** The set's phrases in their new order. */
    order?: string[];
  },
) => api<SetDetail>(`/library/sets/${encodeURIComponent(id)}`, { method: 'POST', body, auth: 'required' });

/** A phrase added on its own: into one of the learner's sets, or their "My phrases" set, made the first time. */
export const addPhrase = (body: { phrase: NewPhrase; targetLang: LanguageCode; nativeLang: LanguageCode; setId?: string; inboxTitle: string }) =>
  api<SetDetail>('/library/phrases', { method: 'POST', body, auth: 'required' });

/** New words for a phrase the learner holds; the server writes its notes again unless they are sent. */
export const editPhrase = (setId: string, phraseId: string, body: { target: string; native: string; image?: string[]; notes?: OwnNotes; notesBy?: 'ai' | 'rules' }) =>
  api<SetDetail>(`/library/sets/${encodeURIComponent(setId)}/phrases/${encodeURIComponent(phraseId)}`, { method: 'POST', body, auth: 'required' });

/** Deletes a phrase the learner holds, from every set of theirs that lists it. */
export const deletePhrase = (id: string) => api<void>(`/library/phrases/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'required' });

export const deleteSet = (id: string) => api<void>(`/library/sets/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'required' });

export const createAlbum = (body: { title: string; description?: string; targetLang: LanguageCode; coverId?: string; visibility: Visibility }) =>
  api<AlbumDetail>('/library/albums', { method: 'POST', body, auth: 'required' });

export const updateAlbum = (id: string, body: { title?: string; description?: string | null; visibility?: Visibility; coverId?: string | null; removeSongIds?: string[] }) =>
  api<AlbumDetail>(`/library/albums/${encodeURIComponent(id)}`, { method: 'POST', body, auth: 'required' });

export const deleteAlbum = (id: string) => api<void>(`/library/albums/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'required' });

export const saveItem = (kind: 'set' | 'album', id: string) => api<{ saved: true }>('/library/saves', { method: 'POST', body: { kind, id }, auth: 'required' });
export const unsaveItem = (kind: 'set' | 'album', id: string) =>
  api<void>(`/library/saves/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'required' });

export const setDisplayName = (displayName: string) =>
  api<{ displayName: string | null }>('/library/profile', { method: 'POST', body: { displayName }, auth: 'required' });

/** What a cover is drawn for: a set or album wears it; a phrase's or song's is the learner's own. */
export type CoverKind = 'set' | 'album' | 'song' | 'phrase';

/**
 * A cover being drawn, or drawn (plan 111): `url` once it is ready, and who drew it. `copy` is the
 * learner's new copy of one of Loro's sets or albums, which wears the cover once it is ready.
 */
export interface CoverState {
  id: string;
  status: 'rendering' | 'ready' | 'failed';
  url: string | null;
  provider: 'ai' | 'pattern';
  copy?: { kind: 'set' | 'album'; id: string };
}

const COVER_POLL_MS = 2_500;
/** About four minutes: longer than the server's image model may take. A later cover still lands. */
const COVER_POLLS = 96;

const readCover = (cover: CoverState): CoverState => ({ ...cover, provider: ai(cover.provider) as CoverState['provider'] });

/**
 * Asks for a cover and waits while the server draws it in the background, asking where it stands
 * every few seconds. With `attachTo` it is drawn for that item's own words and goes on it: the
 * learner's set or album in place, a copy of one of Loro's (made at once), or their own cover of a
 * phrase or song. Resolves with the ready cover, or still `rendering` if it takes longer than the app
 * waits (it takes its place when it is ready); throws if drawing failed. An older server draws before
 * it answers and sends no status: that cover is ready.
 */
export async function generateCover(
  body: { kind: CoverKind; title?: string; description?: string; prompt?: string; attachTo?: string; nativeLang?: LanguageCode },
  pace = { pollMs: COVER_POLL_MS, polls: COVER_POLLS },
): Promise<CoverState> {
  const asked = readCover(await api<CoverState>('/library/generate/cover', { method: 'POST', body, auth: 'required' }));
  let cover = asked;
  for (let polls = 0; cover.status === 'rendering' && polls < pace.polls; polls++) {
    await new Promise((resolve) => setTimeout(resolve, pace.pollMs));
    cover = readCover(await api<CoverState>(`/library/covers/${encodeURIComponent(cover.id)}.json`));
  }
  if (cover.status === 'failed') throw new ApiError(0, 'PROVIDER_UNAVAILABLE', 'The cover could not be drawn');
  return asked.copy ? { ...cover, copy: asked.copy } : cover;
}

/** A cover the learner drew for an item before, with the words they asked it to picture (null: the item's own). */
export interface CoverChoice {
  id: string;
  url: string;
  provider: 'ai' | 'pattern';
  prompt: string | null;
  createdAt: number;
}

/** The covers drawn for an item, newest first, and the one it wears now (`current`). */
export interface CoverHistory {
  covers: CoverChoice[];
  current: string | null;
}

/** The learner's covers for an item they may change, to choose one again without drawing. */
export const fetchCoverHistory = (kind: CoverKind, id: string) =>
  api<CoverHistory>(`/library/covers/${kind}/${encodeURIComponent(id)}`, { auth: 'required' }).then((history) => ({
    ...history,
    covers: history.covers.map((cover) => ({ ...cover, provider: ai(cover.provider) as CoverChoice['provider'] })),
  }));

/** Puts an earlier cover back on the item it was drawn for: nothing is drawn, and no cover is spent. */
export const wearCover = (coverId: string, body: { kind: CoverKind; attachTo: string }) =>
  api<CoverState>(`/library/covers/${encodeURIComponent(coverId)}/wear`, { method: 'POST', body, auth: 'required' }).then(readCover);

/** The lyrics as the server last sent them; a `claude` writer from an older server reads as `ai`. */
const readLyrics = (lyrics: Lyrics): Lyrics => ({ ...lyrics, lyricsBy: lyrics.lyricsBy === null ? null : (ai(lyrics.lyricsBy) as 'ai' | 'phrases') });

const LYRICS_POLL_MS = 2_500;
/** About two and a half minutes: longer than the text model takes to write a song. */
const LYRICS_POLLS = 60;

/** Asks where a draft stands every few seconds until it is written (or failed), or the app stops waiting. */
async function awaitLyrics(lyrics: Lyrics, pace: { pollMs: number; polls: number }): Promise<Lyrics> {
  let draft = lyrics;
  for (let polls = 0; draft.status === 'writing' && polls < pace.polls; polls++) {
    await new Promise((resolve) => setTimeout(resolve, pace.pollMs));
    draft = readLyrics(await api<Lyrics>(`/library/lyrics/${encodeURIComponent(draft.id)}`, { auth: 'required' }));
  }
  return draft;
}

/**
 * Asks for a song's lyrics (plan 113) and waits while the text model writes them in the background.
 * Resolves with the draft: `ready` to read, `failed`, or still `writing` if it took longer than the
 * app waits. Without a text model the server answers at once with the set's phrases arranged.
 */
export async function writeLyrics(
  body: { setId: string; styleId: SongStyle; nativeLang: LanguageCode; title?: string },
  pace = { pollMs: LYRICS_POLL_MS, polls: LYRICS_POLLS },
): Promise<Lyrics> {
  return awaitLyrics(readLyrics(await api<Lyrics>('/library/lyrics', { method: 'POST', body, auth: 'required' })), pace);
}

/** The same draft written again, anew or changed as `instruction` asks, waited for the same way. */
export async function rewriteLyrics(id: string, instruction: string | undefined, pace = { pollMs: LYRICS_POLL_MS, polls: LYRICS_POLLS }): Promise<Lyrics> {
  const body = instruction ? { instruction } : {};
  return awaitLyrics(readLyrics(await api<Lyrics>(`/library/lyrics/${encodeURIComponent(id)}/rewrite`, { method: 'POST', body, auth: 'required' })), pace);
}

export const fetchLyrics = (id: string) => api<Lyrics>(`/library/lyrics/${encodeURIComponent(id)}`, { auth: 'required' }).then(readLyrics);

/** A song: from the learner's approved lyrics (`lyricsId`, plan 113), or with its lyrics written by the server. */
export const generateSong = (body: { setId: string; styleId: SongStyle; nativeLang: LanguageCode; title?: string; albumId?: string; lyricsId?: string }) =>
  api<{ song: Song; album: Album }>('/library/generate/song', { method: 'POST', body, auth: 'required', timeoutMs: 60_000 });

/** A device's Expo push token, with the UI language its messages are in (plan 113). */
export const registerPushToken = (body: { token: string; lang: 'en' | 'bg' | 'ru' | 'pl' | 'cs'; platform?: 'ios' | 'android' }) =>
  api<{ registered: true }>('/library/push-tokens', { method: 'POST', body, auth: 'required' });
export const forgetPushToken = (token: string) => api<void>(`/library/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE', auth: 'required', timeoutMs: 5000 });

export const retrySong = (id: string, nativeLang: LanguageCode) =>
  api<Song>(`/library/songs/${encodeURIComponent(id)}/retry`, { method: 'POST', body: { nativeLang }, auth: 'required' });
export const deleteSong = (id: string) => api<void>(`/library/songs/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'required' });

export const reportItem = (kind: 'set' | 'album', id: string, reason: 'offensive' | 'wrong' | 'spam' | 'other') =>
  api<{ reported: true }>('/library/reports', { method: 'POST', body: { kind, id, reason }, auth: 'required' });

/** Deletes everything the learner keeps in the library; their sign-in stays until they sign out. */
export const deleteEverything = () => api<{ deleted: true }>('/library/me/delete', { method: 'POST', auth: 'required' });
export const deleteAccount = () => api<{ deleted: true }>('/library/me/delete-account', { method: 'POST', auth: 'required' });
