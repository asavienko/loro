import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-native-web-vite'

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const editorialStationeryFonts =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'

const config: StorybookConfig = {
  stories: ['./stories/**/*.stories.tsx'],
  staticDirs: [{ from: './v13/assets', to: '/v13-assets' }],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  previewHead: (head) => `${head}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${editorialStationeryFonts}" rel="stylesheet">`,
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      modulesToTranspile: [
        '@loro/core',
        '@loro/design-tokens',
        '@loro/content',
        'react-native-reanimated',
        'react-native-worklets',
      ],
      pluginReactOptions: {
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            '@babel/plugin-proposal-export-namespace-from',
            ['react-native-worklets/plugin', { disableSourceMaps: true }],
          ],
        },
      },
    },
  },
  async viteFinal(config) {
    const aliasEntries = Array.isArray(config.resolve?.alias)
      ? config.resolve.alias
      : Object.entries(config.resolve?.alias ?? {}).map(([find, replacement]) => ({
          find,
          replacement,
        }))

    config.resolve = {
      ...config.resolve,
      alias: [
        ...aliasEntries,
        {
          find: 'expo-router',
          replacement: path.join(mobileRoot, '.storybook/mocks/expo-router.ts'),
        },
        {
          find: 'react-native-reanimated/scripts/validate-worklets-version',
          replacement: path.join(mobileRoot, '.storybook/mocks/validate-worklets-version.ts'),
        },
        {
          find: /react-native-reanimated\/(?:src|lib\/module)\/ReanimatedModule\/js-reanimated\/webUtils(?:\.web)?$/,
          replacement: path.join(mobileRoot, '.storybook/mocks/reanimated-web-utils.ts'),
        },
        {
          find: /react-native-reanimated\/(?:src|lib\/module)\/ReanimatedModule\/js-reanimated(?:\/index)?$/,
          replacement: path.join(mobileRoot, '.storybook/mocks/js-reanimated-index.ts'),
        },
      ],
    }
    config.define = {
      ...config.define,
      __DEV__: JSON.stringify(true),
    }
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: [
        ...(config.optimizeDeps?.exclude ?? []),
        'react-native-reanimated',
        'react-native-worklets',
      ],
    }
    config.plugins = [
      {
        name: 'loro-storybook-reanimated-web',
        enforce: 'pre',
        resolveId(source, importer) {
          if (
            importer === undefined ||
            !importer.includes(`${path.sep}react-native-reanimated${path.sep}`)
          ) {
            return undefined
          }
          if (source.includes('validate-worklets-version')) {
            return path.join(mobileRoot, '.storybook/mocks/validate-worklets-version.ts')
          }
          if (source === './webUtils' || source.endsWith('/webUtils')) {
            return path.join(mobileRoot, '.storybook/mocks/reanimated-web-utils.ts')
          }
          if (
            source === '../ReanimatedModule/js-reanimated' ||
            source === './js-reanimated' ||
            source.endsWith('/js-reanimated')
          ) {
            return path.join(mobileRoot, '.storybook/mocks/js-reanimated-index.ts')
          }
          return undefined
        },
      },
      {
        name: 'loro-workspace-js-to-ts',
        enforce: 'pre',
        async resolveId(source, importer) {
          if (!source.startsWith('.') || !source.endsWith('.js') || importer === undefined) {
            return undefined
          }
          if (!importer.includes(`${path.sep}packages${path.sep}`)) return undefined
          return (
            (await this.resolve(source.slice(0, -3), importer, { skipSelf: true })) ?? undefined
          )
        },
      },
      ...(config.plugins ?? []),
    ]
    return config
  },
}

export default config
