# Landing page

Loro's one-page site (F-09): what the app does, a working demo of the player, and the newest Android
build to download, with every earlier one. Plain HTML, CSS and JavaScript modules with no build
step, so any static host serves this folder as it is. It is served from AWS Amplify Hosting by
`pnpm landing:deploy` ([landing-deployment.md](../../docs/process/landing-deployment.md)); its
domain is [Q-27](../../docs/decisions/open-questions.md#q-27).

```bash
pnpm --filter @loro/landing dev        # http://localhost:4173 (module scripts don't load from file://)
pnpm --filter @loro/landing test       # node:test over src/releases.js
pnpm --filter @loro/landing lint       # the repository's ESLint, type-aware
pnpm --filter @loro/landing typecheck  # tsc over the JSDoc types (checkJs)
```

| File                | What                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `index.html`        | The page                                                                    |
| `src/styles.css`    | The app's palette and faces, the 3D scenes, the motion                      |
| `src/main.js`       | Fetching and showing the builds; the player demo, the drum, the tilt        |
| `src/releases.js`   | Pure: GitHub's release and compare JSON as builds and changes, newest first |
| `src/snapshot.js`   | The builds as of 2026-10-01, shown only when GitHub can't be reached        |
| `scripts/serve.mjs` | The local static server                                                     |

## How the build list stays current

On every visit the page asks GitHub for the repository's releases
(`GET https://api.github.com/repos/asavienko/loro/releases`, every page) and offers each release
that carries an APK. Nothing in this folder changes for a new build: `pnpm apk:github --publish`
([local-apk.md](../../docs/process/local-apk.md)) is all it takes.

- **Drafts and releases without an `.apk` asset are left out.**
- **Newest first by `published_at`.** GitHub lists releases by when they were created, which is not
  always the order they were published in.
- **The newest build** is the hero's and the footer's download and what the ticket shows, until the
  visitor picks another; then the ticket shows that one's date, size, SHA-256, checksum file and
  release page.
- **What changed** is GitHub's compare between the build's commit and the previous build's, merges
  left out, each commit's first line without its type, scope or requirement IDs. The oldest build
  shows the commit it was made from.
- **Caching:** the list is kept in `localStorage` for 10 minutes and a compare for good, so a reload
  asks GitHub nothing and a visitor stays far inside the 60 requests an hour GitHub allows without
  signing in. A tab coming back after 10 minutes checks again.
- **When GitHub can't be reached** (before the repository goes public, or when the visitor is
  offline or rate-limited) the page says so, offers to try again, and shows the last list that
  browser saw, or else `src/snapshot.js`.

Everything from GitHub goes into the page as text; links are kept only if they point at
`https://github.com/`, and the page's Content-Security-Policy lets it connect to `api.github.com`
and nothing else.

## The film

`#film` plays the video `apps/promo` renders. Its files are not in this folder: they are in the
landing media bucket, named by their content hash, and the page's Content-Security-Policy allows
that bucket in `img-src` (the poster) and `media-src` (the video) and nowhere else.
`pnpm promo:upload` uploads a new render and rewrites the URLs here
([landing-deployment.md](../../docs/process/landing-deployment.md#the-videos-files-the-media-bucket));
the transcript under the video is the narration in `apps/promo/scripts/lines.mjs`, kept by hand.

## Decisions (2026-10-01)

- **The browser reads GitHub on each visit; no list is baked into the page.** A baked list goes
  stale with the next build. Set aside: a copy refreshed on a schedule (it still lags, and each run
  is work) and an API endpoint that holds a GitHub token (backend work and a credential to manage,
  for data that will be public).
- **The repository is public**
  ([ADR-0018](../../docs/architecture/adr/0018-public-source-available-repository.md), Releases
  included), so GitHub's API and the release downloads answer anyone without a token. The owner
  chose this over publishing the APKs to a separate public repository.
- **No build step.** JavaScript with JSDoc types, checked by `tsc` (`checkJs`) and the repository's
  type-aware ESLint, so the folder is the site.
- **The look is the app's:** paper, ink and one terracotta, Newsreader and DM Sans (Literata and
  Manrope for Cyrillic). The demo uses the player's own wording for the loop's steps and the Café &
  Mañanas phrases; the forgetting curve says it is an illustration and shows no numbers, because
  every number Loro shows is real.
