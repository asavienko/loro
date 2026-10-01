/**
 * Loro-owned ElevenLabs style arrays. There is no vendor genre enum (plan 96).
 */
import { isMusicStyleId, type MusicStyleId, type MusicStylePack } from '@loro/core'

export const MUSIC_STYLE_PACK_VERSION = 1

const PACKS: readonly MusicStylePack[] = [
  {
    style_id: 'acoustic_folk',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'acoustic guitar',
      'warm folk',
      'clear lead vocal',
      'gentle percussion',
      'intimate',
      'studio quality',
      'great production quality',
    ],
    negative_styles: ['screamed vocals', 'heavy distortion', 'nightclub drop'],
  },
  {
    style_id: 'modern_pop',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'modern pop',
      'bright chorus',
      'clear diction',
      'mid-tempo',
      'polished mix',
      'great production quality',
    ],
    negative_styles: ['death metal', 'inaudible whispered vocal'],
  },
  {
    style_id: 'gentle_ballad',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'gentle ballad',
      'piano',
      'soft vocal',
      'slow tempo',
      'warm',
      'great production quality',
    ],
    negative_styles: ['rap verse', 'aggressive brass sting'],
    vocal_cue: '{soft vocal}',
  },
  {
    style_id: 'upbeat_kids',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'upbeat acoustic',
      'simple melody',
      'choir-friendly',
      'clear enunciation',
      'cheerful',
      'great production quality',
    ],
    negative_styles: ['horror drone', 'growled vocal'],
  },
  {
    style_id: 'indie_rock',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'indie rock',
      'electric guitars',
      'driving drums',
      'clear lead vocal',
      'anthemic chorus',
      'great production quality',
    ],
    negative_styles: ['screamed vocals', 'heavy distortion', 'blast beats'],
  },
  {
    style_id: 'hip_hop',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'laid-back hip-hop',
      'boom bap drums',
      'warm bass',
      'clear rapped and sung vocal',
      'steady flow',
      'great production quality',
    ],
    negative_styles: ['mumbled vocal', 'explicit language', 'aggressive shouting'],
  },
  {
    style_id: 'reggaeton',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'reggaeton',
      'dembow rhythm',
      'bright synths',
      'clear lead vocal',
      'catchy hook',
      'great production quality',
    ],
    negative_styles: ['heavy autotune', 'mumbled vocal', 'explicit language'],
  },
  {
    style_id: 'jazz_lounge',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'jazz lounge',
      'brushed drums',
      'upright bass',
      'piano',
      'smooth clear vocal',
      'relaxed swing',
      'great production quality',
    ],
    negative_styles: ['scat singing', 'free jazz', 'distorted guitar'],
    vocal_cue: '{soft vocal}',
  },
  {
    style_id: 'electronic_dance',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'electronic dance',
      'four on the floor',
      'bright synth chords',
      'clear lead vocal',
      'uplifting',
      'great production quality',
    ],
    negative_styles: ['heavy vocal processing', 'hardstyle', 'inaudible vocal'],
  },
  {
    style_id: 'country',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'country',
      'acoustic guitar',
      'pedal steel',
      'warm clear vocal',
      'storytelling',
      'great production quality',
    ],
    negative_styles: ['heavy distortion', 'screamed vocals', 'nightclub drop'],
  },
  {
    style_id: 'lullaby',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'lullaby',
      'soft piano',
      'music box',
      'gentle hushed vocal',
      'very slow',
      'tender',
      'great production quality',
    ],
    negative_styles: ['drums', 'loud', 'rap verse'],
    vocal_cue: '{soft vocal}',
  },
  {
    style_id: 'bossa_nova',
    pack_version: MUSIC_STYLE_PACK_VERSION,
    positive_styles: [
      'bossa nova',
      'nylon-string guitar',
      'light percussion',
      'soft clear vocal',
      'breezy',
      'great production quality',
    ],
    negative_styles: ['distorted guitar', 'shouted vocal', 'nightclub drop'],
    vocal_cue: '{soft vocal}',
  },
]

export const MUSIC_STYLE_PACKS: Readonly<Record<MusicStyleId, MusicStylePack>> = Object.fromEntries(
  PACKS.map((pack) => [pack.style_id, pack]),
) as Readonly<Record<MusicStyleId, MusicStylePack>>

export function musicStylePack(styleId: string): MusicStylePack {
  if (!isMusicStyleId(styleId)) throw new Error(`Unknown music style: ${styleId}`)
  return MUSIC_STYLE_PACKS[styleId]
}

export function resolveMusicStylePacks(styleIds: readonly string[]): MusicStylePack[] {
  if (new Set(styleIds).size !== styleIds.length) throw new Error('Duplicate music styles')
  return styleIds.map(musicStylePack)
}
