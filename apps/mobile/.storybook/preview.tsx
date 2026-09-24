import 'react-native-reanimated'
import type { Preview } from '@storybook/react-native-web-vite'

const editorialStationeryFonts =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'

if (typeof document !== 'undefined' && document.getElementById('loro-editorial-fonts') === null) {
  const link = document.createElement('link')
  link.id = 'loro-editorial-fonts'
  link.rel = 'stylesheet'
  link.href = editorialStationeryFonts
  document.head.appendChild(link)
}

if (typeof document !== 'undefined') {
  let style = document.getElementById('loro-v13-styles')
  if (style === null) {
    style = document.createElement('style')
    style.id = 'loro-v13-styles'
    document.head.appendChild(style)
  }
  style.textContent = `
    @keyframes loro-v13-spin { to { transform: rotate(360deg); } }
    [data-testid="v13-frame"][data-v13-face="md"],
    [data-testid="v13-frame"][data-v13-face="md"] * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }
    @keyframes eqWave {
      0%, 100% { height: 4px; }
      50% { height: 16px; }
    }
    .eq-bar-1 { animation: eqWave 0.8s ease-in-out infinite 0.1s; }
    .eq-bar-2 { animation: eqWave 0.9s ease-in-out infinite 0.35s; }
    .eq-bar-3 { animation: eqWave 0.75s ease-in-out infinite 0.2s; }
    .eq-bar-4 { animation: eqWave 0.85s ease-in-out infinite 0.45s; }
    @keyframes sageBreathe {
      0%, 100% { box-shadow: 0 0 0 0 rgba(186, 205, 166, 0.4), inset 0 0 12px rgba(214, 233, 193, 0.15); }
      50% { box-shadow: 0 0 16px 3px rgba(81, 97, 66, 0.6), inset 0 0 16px rgba(214, 233, 193, 0.35); }
    }
    .easy-breathe-glow {
      animation: sageBreathe 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes hardUrgentShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .hard-shimmer-active {
      background-image: linear-gradient(110deg, transparent 20%, rgba(255, 219, 207, 0.18) 45%, rgba(255, 181, 156, 0.3) 50%, transparent 60%);
      background-size: 200% 100%;
      animation: hardUrgentShimmer 3.2s infinite ease-in-out;
    }
    @keyframes iconPop {
      0% { transform: scale(1) rotate(0deg); }
      40% { transform: scale(1.65) rotate(190deg); }
      75% { transform: scale(0.9) rotate(370deg); }
      100% { transform: scale(1) rotate(360deg); }
    }
    .animate-icon-pop { animation: iconPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    @keyframes doubleRecoil {
      0% { transform: scale(1); }
      20% { transform: scale(0.88) translateY(2px); }
      45% { transform: scale(1.05) translateY(-1px); }
      70% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    .animate-double-recoil { animation: doubleRecoil 0.42s ease-out forwards; }
    @keyframes floatCelebratoryChip {
      0% { opacity: 0; transform: translate(-50%, 6px) scale(0.7); }
      25% { opacity: 1; transform: translate(-50%, -18px) scale(1.05); }
      75% { opacity: 1; transform: translate(-50%, -30px) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -44px) scale(0.85); }
    }
    .animate-float-chip {
      animation: floatCelebratoryChip 1.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      pointer-events: none;
    }
    @keyframes energyRingExpand {
      0% { opacity: 0.85; transform: translate(-50%, -50%) scale(0.6); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); }
    }
    .animate-energy-ring {
      animation: energyRingExpand 0.65s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      pointer-events: none;
    }
    @keyframes sparkleFly {
      0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
      100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0) rotate(var(--rot)); }
    }
    .sparkle-particle {
      position: absolute;
      pointer-events: none;
      animation: sparkleFly 0.85s cubic-bezier(0.15, 0.9, 0.3, 1) forwards;
      z-index: 60;
    }
    .sparkle-particle[data-tone="amber"] { color: #f59e0b; }
    .sparkle-particle[data-tone="sage"] { color: #d6e9c1; }
    .sparkle-particle[data-tone="sage-dim"] { color: #bacda6; }
    .sparkle-particle[data-tone="gold"] { color: #fef08a; }
    .sparkle-particle[data-tone="lime"] { color: #84cc16; }
    .sparkle-particle[data-tone="peach"] { color: #ffedd5; }
    .loro-dock-rate { transition: transform 150ms, box-shadow 150ms; }
    .loro-dock-rate:active { transform: scale(0.95); }
  `
}
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../src/lib/i18n'
import { BottomBarProvider } from '../src/ui/BottomBarContext'
import { ThemeProvider } from '../src/ui/ThemeProvider'
import { account } from './v13/tokens'
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
  parameters: {
    options: {
      storySort: {
        order: [
          'v1.3',
          ['Screens', ['Account', 'Today', 'Stream', 'Review'], 'Components'],
          'Primitives',
          'Components',
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const accent = context.globals['accent'] as AccentName
      const textScale = Number(context.globals['textScale']) as TextScale
      const motion = context.globals['reducedMotion'] as 'system' | 'on' | 'off'
      const isV13 = String(context.title).startsWith('v1.3/')
      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemeProvider
              accent={accent}
              textScale={textScale}
              reducedMotion={motion === 'system' ? undefined : motion === 'on'}
            >
              <BottomBarProvider>
                <View
                  style={
                    isV13
                      ? {
                          flex: 1,
                          backgroundColor: account.desk,
                          padding: 24,
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                        }
                      : { flex: 1, backgroundColor: surface.app, padding: space['4'] }
                  }
                >
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
