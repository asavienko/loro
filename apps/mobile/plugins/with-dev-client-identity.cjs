const { AndroidConfig, withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins')

const marker = '// Loro development client: Metro is required for this debug variant.'
const debugBlock = `debug {
            signingConfig signingConfigs.debug
        }`
const debugIdentity = `debug {
            ${marker}
            applicationIdSuffix ".dev"
            resValue "string", "app_name", "Loro Development"
            signingConfig signingConfigs.debug
        }`

function applyDebugIdentity(contents) {
  if (contents.includes(marker)) return contents
  if (!contents.includes(debugBlock))
    throw new Error('Unable to find Android debug build type for the Loro development identity.')
  return contents.replace(debugBlock, debugIdentity)
}

const loroSchemes = ['loro', 'loro-dev']

function replaceLoroSchemes(manifest, scheme) {
  for (const ownedScheme of loroSchemes) {
    AndroidConfig.Scheme.removeScheme(ownedScheme, manifest)
  }
  AndroidConfig.Scheme.appendScheme(scheme, manifest)
  return manifest
}

function withDevClientIdentity(config) {
  const scheme = config.scheme
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = applyDebugIdentity(mod.modResults.contents)
    return mod
  })
  return withAndroidManifest(config, (mod) => {
    mod.modResults = replaceLoroSchemes(mod.modResults, scheme)
    return mod
  })
}

module.exports = withDevClientIdentity
module.exports.applyDebugIdentity = applyDebugIdentity
module.exports.replaceLoroSchemes = replaceLoroSchemes
