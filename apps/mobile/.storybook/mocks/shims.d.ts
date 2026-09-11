declare module 'react-native-reanimated/lib/module/ReanimatedModule/js-reanimated/JSReanimated.js' {
  export function createJSReanimatedModule(): unknown
}

declare module 'react-native-web/dist/exports/StyleSheet/compiler/createReactDOMStyle.js' {
  const createReactDOMStyle: (style: Record<string, unknown>) => Record<string, unknown>
  export default createReactDOMStyle
}

declare module 'react-native-web/dist/exports/StyleSheet/preprocess.js' {
  export function createTransformValue(transform: unknown): unknown
  export function createTextShadowValue(style: Record<string, unknown>): unknown
}
