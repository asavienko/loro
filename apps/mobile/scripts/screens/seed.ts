// The data the screen capture (capture.mjs) serves and stores: the server's languages and every
// course's pack, as GET /library/languages and /library/pack would send them, and saved learner
// states built by the real state machine, so every number the captured screens show comes from the
// same code that shows it in the app. Run by capture.mjs through tsx; prints one JSON object.
import { fixturePack, FIXTURE, installFixture } from '../../src/shared/content/fixture';
import { Album, getSet, setsForCourse, TARGET_LANGUAGES } from '../../src/shared/content';
import type { Song } from '../../src/shared/api/library';
import { DAY, HOUR, MINUTE } from '../../src/shared/state/clock';
import { initialState } from '../../src/shared/state/initial';
import { transition } from '../../src/shared/state/machine';
import { serializeState } from '../../src/shared/state/persistence';
import type { AppState, Grade } from '../../src/shared/state/types';

installFixture();

/** The moment the browser's clock is set to while capturing. */
const NOW = Number(process.argv[2]);
if (!Number.isFinite(NOW)) throw new Error('usage: seed.ts <now-epoch-ms>');

const onboarded = (base: AppState): AppState =>
  transition(base, { type: 'SET_PROFILE', profile: { name: 'Ana', nativeLang: 'en-GB', targetLang: 'es-ES', onboarded: true }, now: NOW - 30 * DAY });

/**
 * Plays `setId` through at `at` as the player would: each phrase's phases end with a measured length
 * (heard), and the phrase is rated in its pause, cycling `grades`; the ratings then count.
 */
function study(state: AppState, setId: string, at: number, grades: Grade[]): AppState {
  const phraseIds = getSet(setId).phraseIds;
  let s = transition(state, { type: 'LOAD', phraseIds, setId, now: at, seed: 1 });
  let t = at;
  for (let i = 0; i < phraseIds.length + 4 && s.player.status === 'playing'; i++) {
    const start = s.player.index;
    for (let phase = 0; phase < 12 && s.player.index === start && s.player.status === 'playing'; phase++) {
      t += 2500;
      s = transition(s, { type: 'PHASE_DONE', cycle: s.player.cycle, now: t, measuredMs: 1400 });
      if (phase === 2) s = transition(s, { type: 'RATE', grade: grades[i % grades.length], now: t + 500 });
    }
  }
  s = transition(s, { type: 'COMMIT', now: t + 10 * MINUTE });
  return transition(s, { type: 'CLOSE' });
}

const base = initialState('screens-device', 'screens-tab');
const fresh = onboarded(base);

// A month of learning: the first sets of the course, reviewed on several days, a few phrases liked.
const sets = setsForCourse('es-ES').slice(0, 4).map((s) => s.id);
let learning = fresh;
const days = [21, 14, 9, 5, 3, 2, 1];
days.forEach((ago, d) => {
  const set = sets[d % sets.length];
  learning = study(learning, set, NOW - ago * DAY - 3 * HOUR, d % 3 === 0 ? ['easy', 'hard', 'easy'] : ['hard', 'missed', 'easy', 'easy']);
});
for (const id of getSet(sets[0]).phraseIds.slice(0, 3)) learning = transition(learning, { type: 'TOGGLE_LIKE', kind: 'phrase', id, now: NOW - DAY });
learning = transition(learning, { type: 'TOGGLE_LIKE', kind: 'set', id: sets[1], now: NOW - DAY });

// The same learner part-way through a set, with the player paused on a phrase.
const playing = transition(
  transition(learning, { type: 'LOAD', phraseIds: getSet(sets[2]).phraseIds, setId: sets[2], now: NOW - MINUTE, seed: 1 }),
  { type: 'PAUSE', now: NOW - MINUTE + 1 },
);

// One of Loro's albums in the course, with a song made from the first set: its lines are the set's
// phrases, as the server writes them without a model, over its labelled demo sound.
const songSet = getSet(sets[0]);
const lines = songSet.phraseIds.map((id, i) => {
  const phrase = FIXTURE.phrases.find((p) => p.id === id)!;
  return { text: phrase.target, meaning: phrase.translations['en-GB'] ?? '', phraseId: id, startMs: i * 4000, endMs: i * 4000 + 3500 };
});
const album: Album = {
  id: 'album-screens',
  title: 'Canciones del Café',
  description: 'Songs from the café sets.',
  coverUrl: null,
  targetLang: 'es-ES',
  owner: 'loro',
  author: null,
  visibility: 'public',
  shareCode: null,
  saved: false,
  songCount: 1,
  durationMs: lines.length * 4000,
  createdAt: NOW - 10 * DAY,
  updatedAt: NOW - 10 * DAY,
};
const song: Song = {
  id: 'song-screens',
  albumId: album.id,
  setId: songSet.id,
  title: 'Un Cortado al Sol',
  styleId: 'acoustic_folk',
  status: 'ready',
  sections: [{ name: 'verse', lines }],
  lyricsBy: 'phrases',
  audioUrl: null,
  audioBy: 'demo',
  voiced: true,
  timingBy: 'demo',
  options: { voice: 'any', tempo: 'natural', mood: null, length: 'short', theme: null },
  durationMs: lines.length * 4000,
  error: null,
  createdAt: NOW - 10 * DAY,
};
// Every phrase has its clips, as the server's voices make them: here, a path the capture answers
// with a moment of silence, so the player plays rather than saying there is no recording.
const withClips = (pack: ReturnType<typeof fixturePack>) => ({
  ...pack,
  phrases: pack.phrases.map((p) => ({
    ...p,
    audio: Object.fromEntries([pack.targetLang, ...Object.keys(p.translations)].map((lang) => [lang, `/library/audio/${p.id}/${lang}.mp3`])),
  })),
});
const packs = Object.fromEntries(TARGET_LANGUAGES.map((lang) => [lang, withClips(fixturePack(lang))]));
packs['es-ES'] = { ...packs['es-ES'], albums: [album] };

// What a signed-in learner's pack adds: a set of their own (one phrase they wrote, two of Loro's)
// and another learner's public set they saved.
const course = packs['es-ES'];
const template = course.phrases[0];
const written = { ...template, id: 'own-screens-1', setId: 'set-mine', target: 'Me encanta este barrio', translations: { 'en-GB': 'I love this neighbourhood', 'en-US': 'I love this neighborhood' }, noteTranslations: {}, source: 'written' as const, notesBy: 'rules' as const };
const learnerSet = (id: string, title: string, phraseIds: string[], extra: object) => ({
  id,
  title,
  subtitle: null,
  description: null,
  topicId: 'everyday',
  level: 'A2' as const,
  coverIcon: 'edit_note',
  coverUrl: null,
  targetLang: 'es-ES' as const,
  phraseIds,
  saved: false,
  ...extra,
});
const mine = learnerSet('set-mine', 'Mi Barrio', [written.id, ...getSet(sets[1]).phraseIds.slice(0, 2)], { owner: 'me', author: 'Ana', visibility: 'private', shareCode: 'minecode01' });
const otherPhrases = getSet(sets[3]).phraseIds.slice(0, 3).map((id, i) => ({ ...course.phrases.find((p) => p.id === id)!, id: `other-screens-${i + 1}`, setId: 'set-other', source: 'written' as const, notesBy: 'ai' as const }));
const other = learnerSet('set-other', 'De Compras con Marta', otherPhrases.map((p) => p.id), { owner: 'other', author: 'Marta', visibility: 'public', shareCode: 'othercode1', saved: true, description: 'What I say at the market every Saturday.', savedBy: 12 });
const signedInPacks = { ...packs, 'es-ES': { ...course, sets: [...course.sets, mine, other], phrases: [...course.phrases, written, ...otherPhrases] } };

process.stdout.write(
  JSON.stringify({
    languages: { version: 'screens', languages: FIXTURE.languages },
    packs,
    signedInPacks,
    mine: { set: mine, phrases: [written] },
    other: { set: other, phrases: otherPhrases },
    album,
    song,
    sets,
    states: {
      new: null,
      fresh: serializeState(fresh),
      learning: serializeState(learning),
      playing: serializeState(playing),
    },
  }),
);
