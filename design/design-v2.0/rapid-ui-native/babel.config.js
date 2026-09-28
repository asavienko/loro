/* global module */
// Expo's preset, plus static class blocks: the formatjs Intl polyfills Hermes needs use them
// (src/platform/intl.native.ts), and Hermes doesn't parse them.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-class-static-block'],
  };
};
