// What is said in the video: the narrator's lines and the phrase clips the app's own voices speak.
// voice.mjs renders each one once (cached by its text and voice); timeline.mjs places them.

/** The narrator: an ElevenLabs premade voice ("George", warm British), distinct from the app's voices. */
export const NARRATOR = 'JBFqnCBsd6RMkjVDRZzb'

/** The narrator's lines, in order. */
export const LINES = [
  {
    id: 'v01',
    text: 'This is Loro. It teaches you a language the way you’ll actually use it: one phrase at a time.',
  },
  { id: 'v02', text: 'First, you hear the phrase in your own language.' },
  { id: 'v03', text: 'Then it goes quiet. That’s your turn: say it out loud, in Spanish.' },
  { id: 'v04', text: 'Now hear how it’s really said.' },
  { id: 'v05', text: 'Say it once more, just as you heard it. Then rate how it went.' },
  {
    id: 'v06',
    text: 'A real memory model decides when it comes back, so you review it just before you’d forget.',
  },
  {
    id: 'v07',
    text: 'It runs hands-free, like a playlist. On a walk, on the bus, while the coffee brews.',
  },
  { id: 'v08', text: 'Spanish, Bulgarian, Russian, Polish, Czech and English.' },
  {
    id: 'v09',
    text: 'Make sets of your own with AI, for any moment you want to be ready for. Loro even turns your phrases into songs.',
  },
  {
    id: 'v10',
    text: 'Your voice never leaves your phone: nothing is recorded. And no screen ever shames a missed day.',
  },
  { id: 'v11', text: 'Loro is Spanish for parrot. Say it until it’s yours.' },
]

/**
 * The phrases as the app plays them, in its voices (apps/api/.env TTS_VOICE_*). The Polish and Czech
 * lines were made before those languages had voices, so the multilingual model speaks them in the
 * Russian and Bulgarian voices.
 */
export const CLIPS = [
  { id: 'c_en_bill', voice: 'TTS_VOICE_EN_GB', text: 'The bill, please.' },
  { id: 'c_es_bill', voice: 'TTS_VOICE_ES_ES', text: 'La cuenta, por favor.' },
  { id: 'c_es_station', voice: 'TTS_VOICE_ES_ES', text: '¿Dónde está la estación?' },
  { id: 'c_bg_station', voice: 'TTS_VOICE_BG_BG', text: 'Къде е гарата?' },
  { id: 'c_ru_station', voice: 'TTS_VOICE_RU_RU', text: 'Где вокзал?' },
  { id: 'c_pl_station', voice: 'TTS_VOICE_RU_RU', text: 'Gdzie jest dworzec?' },
  { id: 'c_cs_station', voice: 'TTS_VOICE_BG_BG', text: 'Kde je nádraží?' },
  { id: 'c_en_station', voice: 'TTS_VOICE_EN_GB', text: 'Where’s the station?' },
]
