// The library's routes (plan 106): what the app reads, makes and shares. Shapes mirror the API's
// apps/api/src/library/library.types.ts; the app reads them without zod, as it reads its content.
import type { Album, BankTheme, ContentPack, LanguageCode, PhraseSet, PhraseWire, Visibility } from '../content';
import type { OwnNotes } from '../state/types';
import { api } from './client';

export type SongStyle = 'acoustic_folk' | 'modern_pop' | 'gentle_ballad' | 'upbeat_kids';
export const SONG_STYLES: SongStyle[] = ['modern_pop', 'acoustic_folk', 'gentle_ballad', 'upbeat_kids'];

export interface SongLine {
  text: string;
  meaning: string;
  /** The set phrase this line sings, if it is one. */
  phraseId: string | null;
  /** When the line plays, where the sound's timing is known (the demo sound). */
  startMs: number | null;
  endMs: number | null;
}

export interface Song {
  id: string;
  albumId: string;
  setId: string;
  title: string;
  styleId: SongStyle;
  status: 'rendering' | 'ready' | 'failed';
  sections: { name: 'verse' | 'chorus' | 'bridge'; lines: SongLine[] }[];
  /** `claude`, or `phrases`: the set's phrases arranged with nothing added. */
  lyricsBy: 'claude' | 'phrases';
  audioUrl: string | null;
  /** `elevenlabs` (sung), or `demo`: the server's instrumental, labelled "Demo sound". */
  audioBy: 'elevenlabs' | 'demo' | null;
  durationMs: number | null;
  error: string | null;
  createdAt: number;
}

export type UsageKind = 'phrases' | 'cover' | 'song';

export interface Usage {
  day: string;
  resetsAt: number;
  daily: Record<UsageKind, { used: number; limit: number }>;
  kept: Record<'sets' | 'albums' | 'songs', { used: number; limit: number }>;
  /** Who writes each kind on this server: a model, or the labelled fallback. */
  writers: { phrases: 'claude' | 'bank'; cover: 'claude' | 'pattern'; lyrics: 'claude' | 'phrases'; music: 'elevenlabs' | 'demo' };
}

export interface WrittenPhrase {
  target: string;
  native: string;
  image: string[];
  notes: OwnNotes;
  source: 'ai' | 'bank';
  bankId?: string;
}

export interface NewPhrase {
  target: string;
  native: string;
  image: string[];
  notes: OwnNotes;
  source: 'ai' | 'bank' | 'course' | 'written';
  bankId?: string;
}

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

export const fetchCommunitySets = (targetLang: LanguageCode, q = '') =>
  api<{ sets: PhraseSet[]; phrases: PhraseWire[] }>(`/library/community?kind=sets&target=${targetLang}&q=${encodeURIComponent(q)}`);

export const fetchCommunityAlbums = (targetLang: LanguageCode, q = '') =>
  api<{ albums: Album[] }>(`/library/community?kind=albums&target=${targetLang}&q=${encodeURIComponent(q)}`);

export const fetchSet = (id: string) => api<SetDetail>(`/library/sets/${encodeURIComponent(id)}`);
export const fetchAlbum = (id: string) => api<AlbumDetail>(`/library/albums/${encodeURIComponent(id)}`);
export const fetchShared = (code: string) => api<Shared>(`/library/shared/${encodeURIComponent(code)}`);
export const fetchSong = (id: string) => api<Song>(`/library/songs/${encodeURIComponent(id)}`);
export const fetchUsage = () => api<Usage>('/library/usage', { auth: 'required' });

export const createSet = (body: {
  title: string;
  description?: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  level?: 'A1' | 'A2' | 'B1';
  topicId?: string;
  coverId?: string;
  visibility: Visibility;
  phrases: NewPhrase[];
}) => api<SetDetail>('/library/sets', { method: 'POST', body, auth: 'required' });

export const updateSet = (
  id: string,
  body: { title?: string; description?: string | null; visibility?: Visibility; coverId?: string | null; addPhrases?: NewPhrase[]; removePhraseIds?: string[] },
) => api<SetDetail>(`/library/sets/${encodeURIComponent(id)}`, { method: 'POST', body, auth: 'required' });

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

export const generatePhrases = (
  body: { mode: 'topic' | 'keywords' | 'text'; input: string; targetLang: LanguageCode; nativeLang: LanguageCode; count?: number; avoid?: string[] },
  signal?: AbortSignal,
) =>
  api<{ provider: 'claude' | 'bank'; phrases: WrittenPhrase[]; themes: Pick<BankTheme, 'id' | 'title'>[] }>('/library/generate/phrases', {
    method: 'POST',
    body,
    auth: 'required',
    timeoutMs: 120_000,
    signal,
  });

export const generateCover = (body: { kind: 'set' | 'album'; title: string; description?: string; attachTo?: string }) =>
  api<{ id: string; url: string; provider: 'claude' | 'pattern' }>('/library/generate/cover', { method: 'POST', body, auth: 'required', timeoutMs: 120_000 });

export const generateSong = (body: { setId: string; styleId: SongStyle; nativeLang: LanguageCode; title?: string; albumId?: string }) =>
  api<{ song: Song; album: Album }>('/library/generate/song', { method: 'POST', body, auth: 'required', timeoutMs: 60_000 });
