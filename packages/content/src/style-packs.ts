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
]

export const MUSIC_STYLE_PACKS: Readonly<Record<MusicStyleId, MusicStylePack>> = Object.fromEntries(
  PACKS.map((pack) => [pack.style_id, pack]),
) as Readonly<Record<MusicStyleId, MusicStylePack>>

export function musicStylePack(styleId: string): MusicStylePack {
  if (!isMusicStyleId(styleId)) throw new Error(`Unknown music style: ${styleId}`)
  const pack = MUSIC_STYLE_PACKS[styleId]
  if (pack === undefined) throw new Error(`Unknown music style: ${styleId}`)
  return pack
}

export function resolveMusicStylePacks(styleIds: readonly string[]): MusicStylePack[] {
  if (new Set(styleIds).size !== styleIds.length) throw new Error('Duplicate music styles')
  return styleIds.map(musicStylePack)
}
