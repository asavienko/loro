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

function applyDebugIdentity(contents, developmentPackage = false) {
  const identity = developmentPackage
    ? debugIdentity.replace('            applicationIdSuffix ".dev"\n', '')
    : debugIdentity
  // Reconcile previously generated projects when moving the ID into defaultConfig.
  const withoutSuffix = debugIdentity.replace('            applicationIdSuffix ".dev"\n', '')
  if (contents.includes(debugIdentity)) return contents.replace(debugIdentity, identity)
  if (contents.includes(withoutSuffix)) return contents.replace(withoutSuffix, identity)
  if (!contents.includes(debugBlock))
    throw new Error('Unable to find Android debug build type for the Loro development identity.')
  return contents.replace(debugBlock, identity)
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
    mod.modResults.contents = applyDebugIdentity(
      mod.modResults.contents,
      config.android?.package === 'app.loro.android.dev',
    )
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
