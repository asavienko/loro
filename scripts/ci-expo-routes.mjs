import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

// Use the installed Expo SDK's generator, as its CLI does, without starting Metro.
// Revisit these SDK-internal entry points when upgrading Expo Router.
const require = createRequire(import.meta.url)
const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared')
const {
  default: requireContext,
} = require('expo-router/build/testing-library/require-context-ponyfill')
const { getTypedRoutesDeclarationFile } = require('expo-router/build/typed-routes/generate')
const appRoot = resolve('apps/mobile/app')
const output = resolve('apps/mobile/.expo/types')
const context = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE)
if (context.keys().length === 0) throw new Error('No Expo routes found')
const declaration = getTypedRoutesDeclarationFile(context)
if (!declaration) throw new Error('Expo route type generation failed')
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'router.d.ts'), declaration)
console.log('Regenerated Expo route types from the current checkout')
