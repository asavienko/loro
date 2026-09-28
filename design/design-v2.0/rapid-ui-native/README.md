# Loro v2.0 prototype — React Native (Expo)

The web prototype in `../rapid-ui-prototype` as an Expo app (plan
[104](../../../plans/104-prototype-react-native.md)). **Status: foundation only.** The shell, state,
storage, speech, Rust core bridge, navigation and UI primitives are in place and boot on the web;
the screens and sheets are still stand-ins (files marked `STAND-IN`).

## Run

Node 22. From this folder:

```bash
npm install
npm run web          # Expo web: the Rust core runs as WASM
npm run android      # a development build (needs JDK 17, the Android SDK/NDK and cargo-ndk)
```

Expo Go can't run it: the Rust core comes from `apps/mobile/modules/loro-core`, a native module
autolinked from there (`package.json` → `expo.autolinking`).

## How it's built

- **Shared behaviour.** `@shared/*` is the web prototype's `src`: content, the state machine,
  persistence, copy, the suggestion generator. Nothing is copied.
- **The platform edge.** On iOS and Android, `metro.config.js` swaps four modules for the ones in
  `src/platform/`: storage (AsyncStorage), speech (expo-speech), cues (haptics) and the Rust core
  (the LoroCore module). On the web the originals run.
- **UI.** `src/ui/` holds the primitives in the prototype's tokens (`theme.ts`); `app/` the routes
  (expo-router); `src/nav/Shell.tsx` implements the prototype's `Navigation` interface.
- `npm run icons` rebuilds the Material Symbols subset (TrueType, outlined and filled) from the web
  prototype's icon list.
