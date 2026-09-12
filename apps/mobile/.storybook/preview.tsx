import 'react-native-reanimated'
import type { Preview } from '@storybook/react-native-web-vite'

const editorialStationeryFonts =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap'

if (typeof document !== 'undefined' && document.getElementById('loro-editorial-fonts') === null) {
  const link = document.createElement('link')
  link.id = 'loro-editorial-fonts'
  link.rel = 'stylesheet'
  link.href = editorialStationeryFonts
  document.head.appendChild(link)
}
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../src/lib/i18n'
import { BottomBarProvider } from '../src/ui/BottomBarContext'
import { ThemeProvider } from '../src/ui/ThemeProvider'
import { space, surface } from '../src/ui/theme'
import type { AccentName } from '../src/ui/theme'
import type { TextScale } from '../src/ui/themeContext'

const preview: Preview = {
  globalTypes: {
    accent: {
      description: 'Generated accent theme',
      toolbar: {
        title: 'Accent',
        items: [
          { value: 'coral', title: 'Coral' },
          { value: 'sunset', title: 'Sunset' },
          { value: 'teal', title: 'Teal' },
          { value: 'berry', title: 'Berry' },
        ],
      },
    },
    textScale: {
      description: 'Inspection text scale',
      toolbar: {
        title: 'Text scale',
        items: [
          { value: '1', title: '100%' },
          { value: '2', title: '200%' },
          { value: '3.1', title: '310%' },
        ],
      },
    },
    reducedMotion: {
      description: 'Reduce Motion inspection seam',
      toolbar: {
        title: 'Motion',
        items: [
          { value: 'system', title: 'System' },
          { value: 'on', title: 'Reduce motion' },
          { value: 'off', title: 'Full motion' },
        ],
      },
    },
  },
  initialGlobals: {
    accent: 'coral',
    textScale: '1',
    reducedMotion: 'system',
  },
  decorators: [
    (Story, context) => {
      const accent = context.globals['accent'] as AccentName
      const textScale = Number(context.globals['textScale']) as TextScale
      const motion = context.globals['reducedMotion'] as 'system' | 'on' | 'off'
      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemeProvider
              accent={accent}
              textScale={textScale}
              reducedMotion={motion === 'system' ? undefined : motion === 'on'}
            >
              <BottomBarProvider>
                <View style={{ flex: 1, backgroundColor: surface.app, padding: space['4'] }}>
                  <Story />
                </View>
              </BottomBarProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )
    },
  ],
}

export default preview
