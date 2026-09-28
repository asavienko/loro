import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { phraseSuggestions } from './server/suggest';
import { validateContent } from './src/content/validate';

const repoRoot = path.resolve(__dirname, '../../..');
const coreBrowser = path.join(repoRoot, 'packages/core-rs/browser/loro_core.js');

/**
 * packages/core-rs/browser/loro_core.js is generated CommonJS (two
 * `exports.x = x` lines around a synchronously instantiated WASM module). The
 * dev server and the build both want ESM, so those two lines become exports.
 */
function loroCoreEsm(): Plugin {
  return {
    name: 'loro-core-esm',
    transform(code, id) {
      if (path.resolve(id.split('?')[0]) !== coreBrowser) return null;
      const names: string[] = [];
      const body = code.replace(/^exports\.(\w+) = \w+;$/gm, (_, name: string) => {
        names.push(name);
        return '';
      });
      if (names.length === 0) this.error('loro_core.js: no exports found; did the generator change?');
      return { code: `${body}\nexport { ${names.join(', ')} };\n`, map: null };
    },
  };
}

/** The app ships without zod: the content is validated here instead, and a bad file stops the build. */
function contentCheck(): Plugin {
  return {
    name: 'loro-content-check',
    buildStart() {
      const problems = validateContent();
      if (problems.length > 0) this.error(`Invalid content:\n${problems.join('\n')}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  // The dev and preview servers write suggestions with Claude when ANTHROPIC_API_KEY is set, in the
  // shell or in an untracked .env.local; the key stays in this process (server/suggest.ts).
  const env = loadEnv(mode, __dirname, '');
  return {
    plugins: [
      phraseSuggestions({ apiKey: env.ANTHROPIC_API_KEY, model: env.LORO_SUGGEST_MODEL }),
      contentCheck(),
      loroCoreEsm(),
      react(),
      tailwindcss(),
      VitePWA({
        // A new version waits: auto-updating reloads the page, which would cut a lesson off
        // mid-phrase. src/pwa.ts registers the worker and the app offers Reload when nothing
        // is playing; otherwise it takes over on the next launch.
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'icons/icon.svg', 'fonts/*.woff2'],
        manifest: {
          name: 'Loro',
          short_name: 'Loro',
          description: 'Learn a language by the phrase: listen, say it, hear it.',
          lang: 'en',
          start_url: '.',
          display: 'standalone',
          orientation: 'any',
          background_color: '#fcf9f4',
          theme_color: '#fcf9f4',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // The core WASM is inlined in its chunk; let it be precached.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,png,svg}', 'fonts/*.woff2'],
          // Text fonts come in many script subsets and a page only needs one or two: they are
          // cached as the browser actually loads them, not all up front.
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/assets/') && url.pathname.endsWith('.woff2'),
              handler: 'CacheFirst',
              options: { cacheName: 'loro-fonts', expiration: { maxEntries: 40 } },
            },
          ],
        },
      }),
    ],
    server: {
      fs: { allow: [repoRoot] },
    },
    build: {
      rollupOptions: {
        output: {
          // The Rust core (WASM inlined) changes rarely: its own long-cached chunk.
          manualChunks: (id) => (path.resolve(id) === coreBrowser ? 'loro-core' : undefined),
        },
      },
      // loro-core is ~900 kB of inlined WASM by design.
      chunkSizeWarningLimit: 1000,
    },
  };
});
