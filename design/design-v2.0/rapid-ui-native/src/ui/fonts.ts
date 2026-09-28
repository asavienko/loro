// The prototype's faces. Newsreader (serif) and DM Sans (sans) have no Cyrillic, so Bulgarian and
// Russian take Literata and Manrope, as the web's font stacks fall back to them. React Native has no
// stacks: Txt picks the face by script instead.
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_500Medium,
  Literata_500Medium_Italic,
  Literata_600SemiBold,
  Literata_600SemiBold_Italic,
} from '@expo-google-fonts/literata';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  Newsreader_600SemiBold_Italic,
} from '@expo-google-fonts/newsreader';

export const FONTS = {
  'serif-400': Newsreader_400Regular,
  'serif-400i': Newsreader_400Regular_Italic,
  'serif-500': Newsreader_500Medium,
  'serif-500i': Newsreader_500Medium_Italic,
  'serif-600': Newsreader_600SemiBold,
  'serif-600i': Newsreader_600SemiBold_Italic,
  'serif-cyr-400': Literata_400Regular,
  'serif-cyr-400i': Literata_400Regular_Italic,
  'serif-cyr-500': Literata_500Medium,
  'serif-cyr-500i': Literata_500Medium_Italic,
  'serif-cyr-600': Literata_600SemiBold,
  'serif-cyr-600i': Literata_600SemiBold_Italic,
  'sans-400': DMSans_400Regular,
  'sans-500': DMSans_500Medium,
  'sans-600': DMSans_600SemiBold,
  'sans-700': DMSans_700Bold,
  'sans-cyr-400': Manrope_400Regular,
  'sans-cyr-500': Manrope_500Medium,
  'sans-cyr-600': Manrope_600SemiBold,
  'sans-cyr-700': Manrope_700Bold,
  MaterialSymbols: require('../../assets/fonts/MaterialSymbols.ttf'),
  MaterialSymbolsFill: require('../../assets/fonts/MaterialSymbolsFill.ttf'),
};

export type Face = 'serif' | 'sans';
export type Weight = 400 | 500 | 600 | 700;

const CYRILLIC = /[Ѐ-ӿ]/;

/** The loaded family for a face, weight and style; Cyrillic text takes the Cyrillic faces. */
export function fontFamily(face: Face, weight: Weight, italic: boolean, text: string | null, lang?: string): string {
  const cyrillic = lang ? /^(bg|ru)/.test(lang) : text !== null && CYRILLIC.test(text);
  if (face === 'serif') {
    const w = weight >= 600 ? 600 : weight;
    return `serif-${cyrillic ? 'cyr-' : ''}${w}${italic ? 'i' : ''}`;
  }
  return `sans-${cyrillic ? 'cyr-' : ''}${weight}`;
}
