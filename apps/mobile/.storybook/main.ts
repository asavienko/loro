import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-native-web-vite'

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const config: StorybookConfig = {
  stories: ['./stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      modulesToTranspile: ['@loro/core', '@loro/design-tokens', '@loro/content'],
      pluginReactOptions: {
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            '@babel/plugin-proposal-export-namespace-from',
            'react-native-reanimated/plugin',
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
      ],
    }
    config.define = {
      ...config.define,
      __DEV__: JSON.stringify(true),
    }
    config.plugins = [
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
