// The app's faces: Newsreader and DM Sans, with Literata and Manrope for Cyrillic (the app's stacks
// fall back to them the same way), and the app's Material Symbols subset for icons.
import { loadFont as dmSans } from '@remotion/google-fonts/DMSans'
import { loadFont as literata } from '@remotion/google-fonts/Literata'
import { loadFont as manrope } from '@remotion/google-fonts/Manrope'
import { loadFont as newsreader } from '@remotion/google-fonts/Newsreader'
import { continueRender, delayRender, staticFile } from 'remotion'

const latin = { subsets: ['latin', 'latin-ext'] as ('latin' | 'latin-ext')[] }
const cyr = { subsets: ['cyrillic', 'latin'] as ('cyrillic' | 'latin')[] }
const serifName = newsreader('normal', { weights: ['400', '500', '600'], ...latin }).fontFamily
newsreader('italic', { weights: ['400', '500', '600'], ...latin })
const sansName = dmSans('normal', { weights: ['400', '500', '600', '700'], ...latin }).fontFamily
const serifCyr = literata('normal', { weights: ['400', '600'], ...cyr }).fontFamily
literata('italic', { weights: ['400', '600'], ...cyr })
const sansCyr = manrope('normal', { weights: ['400', '500', '600', '700'], ...cyr }).fontFamily

export const SERIF = `"${serifName}", "${serifCyr}", Georgia, serif`
export const SANS = `"${sansName}", "${sansCyr}", system-ui, sans-serif`

const icons = delayRender('Loading the icon fonts')
Promise.all([
  new FontFace('LoroSymbols', `url(${staticFile('fonts/MaterialSymbols.ttf')})`).load(),
  new FontFace('LoroSymbolsFill', `url(${staticFile('fonts/MaterialSymbolsFill.ttf')})`).load(),
])
  .then((faces) => {
    for (const f of faces) document.fonts.add(f)
    continueRender(icons)
  })
  .catch((err: unknown) => {
    console.error(err)
    continueRender(icons)
  })
