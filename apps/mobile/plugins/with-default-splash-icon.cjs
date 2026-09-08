const { withAndroidStyles } = require('expo/config-plugins')

/** SDK 54's template references splashscreen_logo even when no image was configured. */
module.exports = function withDefaultSplashIcon(config) {
  return withAndroidStyles(config, (mod) => {
    if (config.splash?.image || config.android?.splash?.image) return mod
    const splash = mod.modResults.resources.style?.find(
      (style) => style.$.name === 'Theme.App.SplashScreen',
    )
    const icon = splash?.item?.find((item) => item.$.name === 'windowSplashScreenAnimatedIcon')
    if (icon) icon._ = '@mipmap/ic_launcher'
    return mod
  })
}
